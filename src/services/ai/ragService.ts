import prisma from '../../db/prisma';
import { embedText } from './embeddingService';

interface RelevantContext {
  content: string;
  url: string;
  title: string;
  similarity: number;
}

export class RAGService {
  /**
   * Perform semantic search to find relevant website content
   * Uses cosine distance for vector similarity
   */
  async semanticSearch(
    query: string,
    tenantId: string,
    limit: number = 5
  ): Promise<RelevantContext[]> {
    try {
      // Generate embedding for the query
      const queryEmbedding = await embedText(query);

      // Convert to PostgreSQL vector format
      const vectorString = `[${queryEmbedding.join(',')}]`;

      // Perform vector similarity search using cosine distance
      // <-> is the cosine distance operator in pgvector
      const results = await prisma.$queryRaw<any[]>`
        SELECT 
          id,
          url,
          title,
          content,
          "chunkIndex",
          "tokenCount",
          (embedding <-> ${vectorString}::vector) as distance
        FROM "WebsiteContent"
        WHERE "tenantId" = ${tenantId}
        ORDER BY embedding <-> ${vectorString}::vector
        LIMIT ${limit}
      `;

      // Convert distance to similarity score (0-1, higher is better)
      return results.map(r => ({
        content: r.content,
        url: r.url,
        title: r.title,
        similarity: 1 - r.distance, // Convert distance to similarity
      }));
    } catch (error) {
      console.error('Semantic search error:', error);
      return [];
    }
  }

  /**
   * Get relevant context for AI prompt
   * Returns combined text from top matching chunks
   */
  async getRelevantContext(
    query: string,
    tenantId: string,
    maxChunks: number = 5
  ): Promise<string> {
    const results = await this.semanticSearch(query, tenantId, maxChunks);

    if (results.length === 0) {
      return '';
    }

    // Format context with source URLs
    const contextParts = results.map((r, i) => {
      return `[Source ${i + 1}: ${r.title} - ${r.url}]\n${r.content}`;
    });

    return contextParts.join('\n\n---\n\n');
  }

  /**
   * Check if tenant has any scraped website content
   */
  async hasWebsiteContent(tenantId: string): Promise<boolean> {
    const count = await prisma.websiteContent.count({
      where: { tenantId },
    });

    return count > 0;
  }

  /**
   * Get statistics about scraped content
   */
  async getContentStats(tenantId: string) {
    const sources = await prisma.websiteSource.findMany({
      where: { tenantId },
      include: {
        _count: {
          select: { contents: true },
        },
      },
    });

    const totalChunks = await prisma.websiteContent.count({
      where: { tenantId },
    });

    const totalTokens = await prisma.websiteContent.aggregate({
      where: { tenantId },
      _sum: { tokenCount: true },
    });

    return {
      sources: sources.length,
      totalPages: sources.reduce((sum, s) => sum + (s.pagesScraped || 0), 0),
      totalChunks,
      totalTokens: totalTokens._sum.tokenCount || 0,
      websites: sources.map(s => ({
        id: s.id,
        domain: s.domain,
        url: s.url,
        status: s.status,
        pagesScraped: s.pagesScraped,
        lastScrapedAt: s.lastScrapedAt,
        chunks: s._count.contents,
      })),
    };
  }
}

export const ragService = new RAGService();
