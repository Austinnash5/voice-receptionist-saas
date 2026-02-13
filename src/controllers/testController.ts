import { Request, Response } from 'express';
import { searchFAQs, lookupKnowledgeBase, getBusinessHoursStatus, getKnowledgeStats } from '../services/ai/toolFunctions';

/**
 * Test FAQ Search
 */
export async function testFAQSearch(req: Request, res: Response) {
  try {
    const { tenantId } = req.params;
    const { query } = req.body;

    if (!query) {
      return res.status(400).json({ success: false, error: 'Query required' });
    }

    const result = await searchFAQs(tenantId, query);

    res.json({
      success: true,
      query,
      result,
    });
  } catch (error) {
    console.error('Test FAQ search error:', error);
    res.status(500).json({ success: false, error: 'Failed to search FAQs' });
  }
}

/**
 * Test Knowledge Base Search
 */
export async function testKnowledgeSearch(req: Request, res: Response) {
  try {
    const { tenantId } = req.params;
    const { query } = req.body;

    if (!query) {
      return res.status(400).json({ success: false, error: 'Query required' });
    }

    const result = await lookupKnowledgeBase(tenantId, query);

    res.json({
      success: true,
      query,
      result,
    });
  } catch (error) {
    console.error('Test knowledge search error:', error);
    res.status(500).json({ success: false, error: 'Failed to search knowledge base' });
  }
}

/**
 * Test Business Hours Check
 */
export async function testBusinessHours(req: Request, res: Response) {
  try {
    const { tenantId } = req.params;

    const result = await getBusinessHoursStatus(tenantId);

    res.json({
      success: true,
      result,
    });
  } catch (error) {
    console.error('Test business hours error:', error);
    res.status(500).json({ success: false, error: 'Failed to check business hours' });
  }
}

/**
 * Get Knowledge Statistics
 */
export async function getStats(req: Request, res: Response) {
  try {
    const { tenantId } = req.params;

    const stats = await getKnowledgeStats(tenantId);

    res.json({
      success: true,
      stats,
    });
  } catch (error) {
    console.error('Get stats error:', error);
    res.status(500).json({ success: false, error: 'Failed to get statistics' });
  }
}
