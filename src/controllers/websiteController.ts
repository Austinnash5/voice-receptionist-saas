import { Request, Response } from 'express';
import { websiteScraperService } from '../services/website/websiteScraperService';
import { ragService } from '../services/ai/ragService';
import prisma from '../db/prisma';

/**
 * Start scraping a website
 * POST /api/tenants/:tenantId/websites
 */
export async function startWebsiteScrape(req: Request, res: Response) {
  try {
    const { tenantId } = req.params;
    const { url } = req.body;

    if (!url) {
      return res.status(400).json({ error: 'Website URL is required' });
    }

    // Validate URL
    try {
      new URL(url);
    } catch (e) {
      return res.status(400).json({ error: 'Invalid URL format' });
    }

    // Check if tenant exists
    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
    });

    if (!tenant) {
      return res.status(404).json({ error: 'Tenant not found' });
    }

    // Start scraping
    const websiteSourceId = await websiteScraperService.scrapeWebsite(tenantId, url);

    res.json({
      message: 'Website scraping started',
      websiteSourceId,
    });
  } catch (error) {
    console.error('Error starting website scrape:', error);
    res.status(500).json({ error: 'Failed to start website scraping' });
  }
}

/**
 * Get all website sources for a tenant
 * GET /api/tenants/:tenantId/websites
 */
export async function listWebsiteSources(req: Request, res: Response) {
  try {
    const { tenantId } = req.params;

    const sources = await prisma.websiteSource.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
      include: {
        _count: {
          select: { contents: true },
        },
      },
    });

    res.json({
      sources: sources.map(s => ({
        id: s.id,
        domain: s.domain,
        url: s.url,
        status: s.status,
        pagesFound: s.pagesFound,
        pagesScraped: s.pagesScraped,
        chunks: s._count.contents,
        lastScrapedAt: s.lastScrapedAt,
        errorMessage: s.errorMessage,
        createdAt: s.createdAt,
      })),
    });
  } catch (error) {
    console.error('Error listing website sources:', error);
    res.status(500).json({ error: 'Failed to fetch website sources' });
  }
}

/**
 * Get scraping status for a specific website
 * GET /api/tenants/:tenantId/websites/:websiteId
 */
export async function getWebsiteStatus(req: Request, res: Response) {
  try {
    const { tenantId, websiteId } = req.params;

    const website = await prisma.websiteSource.findFirst({
      where: {
        id: websiteId,
        tenantId,
      },
      include: {
        _count: {
          select: { contents: true },
        },
      },
    });

    if (!website) {
      return res.status(404).json({ error: 'Website not found' });
    }

    res.json({
      id: website.id,
      domain: website.domain,
      url: website.url,
      status: website.status,
      pagesFound: website.pagesFound,
      pagesScraped: website.pagesScraped,
      chunks: website._count.contents,
      lastScrapedAt: website.lastScrapedAt,
      errorMessage: website.errorMessage,
      createdAt: website.createdAt,
    });
  } catch (error) {
    console.error('Error getting website status:', error);
    res.status(500).json({ error: 'Failed to fetch website status' });
  }
}

/**
 * Delete a website source and all its content
 * DELETE /api/tenants/:tenantId/websites/:websiteId
 */
export async function deleteWebsiteSource(req: Request, res: Response) {
  try {
    const { tenantId, websiteId } = req.params;

    // Verify ownership
    const website = await prisma.websiteSource.findFirst({
      where: {
        id: websiteId,
        tenantId,
      },
    });

    if (!website) {
      return res.status(404).json({ error: 'Website not found' });
    }

    // Delete (will cascade to contents)
    await websiteScraperService.deleteWebsiteSource(websiteId);

    res.json({ message: 'Website deleted successfully' });
  } catch (error) {
    console.error('Error deleting website source:', error);
    res.status(500).json({ error: 'Failed to delete website source' });
  }
}

/**
 * Re-scrape a website
 * POST /api/tenants/:tenantId/websites/:websiteId/rescan
 */
export async function rescanWebsite(req: Request, res: Response) {
  try {
    const { tenantId, websiteId } = req.params;

    // Get existing source
    const website = await prisma.websiteSource.findFirst({
      where: {
        id: websiteId,
        tenantId,
      },
    });

    if (!website) {
      return res.status(404).json({ error: 'Website not found' });
    }

    // Start new scrape (will update existing source)
    await websiteScraperService.scrapeWebsite(tenantId, website.url);

    res.json({ message: 'Website re-scan started' });
  } catch (error) {
    console.error('Error rescanning website:', error);
    res.status(500).json({ error: 'Failed to rescan website' });
  }
}

/**
 * Get content statistics
 * GET /api/tenants/:tenantId/websites/stats
 */
export async function getWebsiteStats(req: Request, res: Response) {
  try {
    const { tenantId } = req.params;

    const stats = await ragService.getContentStats(tenantId);

    res.json(stats);
  } catch (error) {
    console.error('Error getting website stats:', error);
    res.status(500).json({ error: 'Failed to fetch website statistics' });
  }
}

/**
 * Test semantic search
 * POST /api/tenants/:tenantId/websites/search
 */
export async function testSemanticSearch(req: Request, res: Response) {
  try {
    const { tenantId } = req.params;
    const { query, limit = 5 } = req.body;

    if (!query) {
      return res.status(400).json({ error: 'Search query is required' });
    }

    const results = await ragService.semanticSearch(query, tenantId, limit);

    res.json({ results });
  } catch (error) {
    console.error('Error performing semantic search:', error);
    res.status(500).json({ error: 'Failed to perform semantic search' });
  }
}
