import axios from 'axios';
import * as cheerio from 'cheerio';
import prisma from '../../db/prisma';
import { embedText } from '../ai/embeddingService';

interface ScrapedPage {
  url: string;
  title: string;
  content: string;
  links: string[];
}

interface ContentChunk {
  content: string;
  tokenCount: number;
}

export class WebsiteScraperService {
  private readonly MAX_PAGES = 100; // Limit pages per website
  private readonly MAX_CHUNK_TOKENS = 500; // Tokens per chunk
  private readonly CHARS_PER_TOKEN = 4; // Approximate
  private readonly CRAWL_DELAY_MS = 500; // Delay between requests
  private visited = new Set<string>();
  private queue: string[] = [];

  /**
   * Start scraping a website
   */
  async scrapeWebsite(tenantId: string, websiteUrl: string): Promise<string> {
    try {
      const url = new URL(websiteUrl);
      const domain = url.hostname;

      // Create or get existing website source
      let websiteSource = await prisma.websiteSource.findFirst({
        where: { tenantId, domain },
      });

      if (websiteSource) {
        // Update existing source
        websiteSource = await prisma.websiteSource.update({
          where: { id: websiteSource.id },
          data: {
            status: 'SCRAPING',
            url: websiteUrl,
            pagesFound: 0,
            pagesScraped: 0,
            errorMessage: null,
          },
        });

        // Delete old content
        await prisma.websiteContent.deleteMany({
          where: { websiteSourceId: websiteSource.id },
        });
      } else {
        // Create new source
        websiteSource = await prisma.websiteSource.create({
          data: {
            tenantId,
            domain,
            url: websiteUrl,
            status: 'SCRAPING',
          },
        });
      }

      // Start crawling in background
      this.crawlWebsite(websiteSource.id, tenantId, websiteUrl, domain).catch(
        async (error) => {
          console.error('Crawl error:', error);
          await prisma.websiteSource.update({
            where: { id: websiteSource!.id },
            data: {
              status: 'FAILED',
              errorMessage: error instanceof Error ? error.message : String(error),
            },
          });
        }
      );

      return websiteSource.id;
    } catch (error) {
      console.error('Website scrape error:', error);
      throw new Error('Failed to start website scraping');
    }
  }

  /**
   * Crawl website recursively
   */
  private async crawlWebsite(
    websiteSourceId: string,
    tenantId: string,
    startUrl: string,
    allowedDomain: string
  ): Promise<void> {
    this.visited.clear();
    this.queue = [startUrl];

    const allPages: ScrapedPage[] = [];

    while (this.queue.length > 0 && this.visited.size < this.MAX_PAGES) {
      const url = this.queue.shift()!;

      if (this.visited.has(url)) continue;
      this.visited.add(url);

      try {
        const page = await this.scrapePage(url, allowedDomain);
        if (page) {
          allPages.push(page);

          // Update progress
          await prisma.websiteSource.update({
            where: { id: websiteSourceId },
            data: {
              pagesFound: this.visited.size,
              pagesScraped: allPages.length,
            },
          });

          // Add new links to queue
          for (const link of page.links) {
            if (!this.visited.has(link) && !this.queue.includes(link)) {
              this.queue.push(link);
            }
          }
        }

        // Rate limiting
        await this.sleep(this.CRAWL_DELAY_MS);
      } catch (error) {
        console.error(`Error scraping ${url}:`, error);
      }
    }

    // Process all pages and store with embeddings
    for (const page of allPages) {
      await this.processAndStorePage(websiteSourceId, tenantId, page);
    }

    // Mark as completed
    await prisma.websiteSource.update({
      where: { id: websiteSourceId },
      data: {
        status: 'COMPLETED',
        lastScrapedAt: new Date(),
        pagesScraped: allPages.length,
      },
    });
  }

  /**
   * Scrape a single page
   */
  private async scrapePage(
    url: string,
    allowedDomain: string
  ): Promise<ScrapedPage | null> {
    try {
      const response = await axios.get(url, {
        timeout: 10000,
        headers: {
          'User-Agent':
            'Mozilla/5.0 (compatible; AIVoiceReceptionist/1.0; +https://example.com/bot)',
        },
      });

      const $ = cheerio.load(response.data);

      // Remove script, style, nav, footer
      $('script, style, nav, footer, header, iframe, noscript').remove();

      // Extract title
      const title = $('title').text().trim() || $('h1').first().text().trim() || '';

      // Extract main content
      let content = '';
      
      // Try to find main content area
      const mainSelectors = ['main', 'article', '[role="main"]', '.content', '#content', 'body'];
      
      for (const selector of mainSelectors) {
        const element = $(selector);
        if (element.length > 0) {
          content = element.text();
          break;
        }
      }

      // Clean up content
      content = content
        .replace(/\s+/g, ' ') // Collapse whitespace
        .replace(/\n+/g, '\n') // Collapse newlines
        .trim();

      // Skip if too short
      if (content.length < 100) {
        return null;
      }

      // Extract links
      const links: string[] = [];
      $('a[href]').each((_, element) => {
        const href = $(element).attr('href');
        if (href) {
          try {
            const absoluteUrl = new URL(href, url);
            
            // Only follow links within the same domain
            if (
              absoluteUrl.hostname === allowedDomain &&
              !absoluteUrl.pathname.match(/\.(pdf|jpg|jpeg|png|gif|zip|doc|docx|xls|xlsx)$/i)
            ) {
              // Remove hash and query params for deduplication
              absoluteUrl.hash = '';
              links.push(absoluteUrl.toString());
            }
          } catch (e) {
            // Skip invalid URLs
          }
        }
      });

      return {
        url,
        title,
        content,
        links: [...new Set(links)], // Deduplicate
      };
    } catch (error) {
      if (axios.isAxiosError(error) && error.response?.status === 404) {
        return null; // Skip 404s silently
      }
      throw error;
    }
  }

  /**
   * Process page content, chunk it, generate embeddings, and store
   */
  private async processAndStorePage(
    websiteSourceId: string,
    tenantId: string,
    page: ScrapedPage
  ): Promise<void> {
    // Chunk the content
    const chunks = this.chunkText(page.content);

    // Process each chunk
    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      
      // Generate embedding
      const embedding = await embedText(chunk.content);

      // Store in database
      await prisma.$executeRaw`
        INSERT INTO "WebsiteContent" (
          id, "websiteSourceId", "tenantId", url, title, content, 
          "chunkIndex", "tokenCount", embedding, "createdAt", "updatedAt"
        ) VALUES (
          gen_random_uuid(), ${websiteSourceId}, ${tenantId}, ${page.url}, 
          ${page.title}, ${chunk.content}, ${i}, ${chunk.tokenCount}, 
          ${embedding}::vector, NOW(), NOW()
        )
      `;
    }
  }

  /**
   * Chunk text into smaller pieces based on token estimate
   */
  private chunkText(text: string): ContentChunk[] {
    const maxChars = this.MAX_CHUNK_TOKENS * this.CHARS_PER_TOKEN;
    const chunks: ContentChunk[] = [];

    // Split by paragraphs first
    const paragraphs = text.split(/\n+/).filter(p => p.trim().length > 0);
    
    let currentChunk = '';
    
    for (const paragraph of paragraphs) {
      // If adding this paragraph would exceed max, save current chunk
      if (currentChunk.length + paragraph.length > maxChars && currentChunk.length > 0) {
        chunks.push({
          content: currentChunk.trim(),
          tokenCount: Math.ceil(currentChunk.length / this.CHARS_PER_TOKEN),
        });
        currentChunk = '';
      }

      // If single paragraph is too long, split by sentences
      if (paragraph.length > maxChars) {
        const sentences = paragraph.split(/[.!?]+\s+/);
        for (const sentence of sentences) {
          if (currentChunk.length + sentence.length > maxChars && currentChunk.length > 0) {
            chunks.push({
              content: currentChunk.trim(),
              tokenCount: Math.ceil(currentChunk.length / this.CHARS_PER_TOKEN),
            });
            currentChunk = '';
          }
          currentChunk += sentence + '. ';
        }
      } else {
        currentChunk += paragraph + '\n';
      }
    }

    // Add remaining chunk
    if (currentChunk.trim().length > 0) {
      chunks.push({
        content: currentChunk.trim(),
        tokenCount: Math.ceil(currentChunk.length / this.CHARS_PER_TOKEN),
      });
    }

    return chunks;
  }

  /**
   * Get scraping status
   */
  async getScrapingStatus(websiteSourceId: string) {
    return prisma.websiteSource.findUnique({
      where: { id: websiteSourceId },
      include: {
        _count: {
          select: { contents: true },
        },
      },
    });
  }

  /**
   * Delete website source and all its content
   */
  async deleteWebsiteSource(websiteSourceId: string) {
    await prisma.websiteSource.delete({
      where: { id: websiteSourceId },
    });
  }

  /**
   * Sleep utility
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

export const websiteScraperService = new WebsiteScraperService();
