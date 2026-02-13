import { Request, Response } from 'express';
import prisma from '../db/prisma';

/**
 * FAQ Management
 */

// List FAQs for a tenant
export async function listFAQs(req: Request, res: Response) {
  try {
    const { tenantId } = req.params;
    
    // Check if user has access to this tenant
    if (req.user?.role !== 'SUPER_ADMIN' && req.user?.tenantId !== tenantId) {
      return res.status(403).json({ success: false, error: 'Access denied' });
    }

    const faqs = await prisma.fAQ.findMany({
      where: { tenantId },
      orderBy: [{ category: 'asc' }, { order: 'asc' }],
    });

    res.json({ success: true, faqs });
  } catch (error) {
    console.error('List FAQs error:', error);
    res.status(500).json({ success: false, error: 'Failed to load FAQs' });
  }
}

// Create FAQ
export async function createFAQ(req: Request, res: Response) {
  try {
    const { tenantId } = req.params;
    const { question, answer, category } = req.body;

    // Check access
    if (req.user?.role !== 'SUPER_ADMIN' && req.user?.tenantId !== tenantId) {
      return res.status(403).json({ success: false, error: 'Access denied' });
    }

    if (!question || !answer) {
      return res.status(400).json({ success: false, error: 'Question and answer required' });
    }

    const faq = await prisma.fAQ.create({
      data: {
        tenantId,
        question,
        answer,
        category: category || null,
      },
    });

    res.json({ success: true, faq });
  } catch (error) {
    console.error('Create FAQ error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({ success: false, error: `Failed to create FAQ: ${errorMessage}` });
  }
}

// Update FAQ
export async function updateFAQ(req: Request, res: Response) {
  try {
    const { tenantId, faqId } = req.params;
    const { question, answer, category, isActive } = req.body;

    // Check access
    if (req.user?.role !== 'SUPER_ADMIN' && req.user?.tenantId !== tenantId) {
      return res.status(403).json({ success: false, error: 'Access denied' });
    }

    const faq = await prisma.fAQ.update({
      where: { id: faqId },
      data: {
        question,
        answer,
        category,
        isActive,
      },
    });

    res.json({ success: true, faq });
  } catch (error) {
    console.error('Update FAQ error:', error);
    res.status(500).json({ success: false, error: 'Failed to update FAQ' });
  }
}

// Delete FAQ
export async function deleteFAQ(req: Request, res: Response) {
  try {
    const { tenantId, faqId } = req.params;

    // Check access
    if (req.user?.role !== 'SUPER_ADMIN' && req.user?.tenantId !== tenantId) {
      return res.status(403).json({ success: false, error: 'Access denied' });
    }

    await prisma.fAQ.delete({
      where: { id: faqId },
    });

    res.json({ success: true });
  } catch (error) {
    console.error('Delete FAQ error:', error);
    res.status(500).json({ success: false, error: 'Failed to delete FAQ' });
  }
}

/**
 * Knowledge Base Management
 */

// List knowledge base entries
export async function listKnowledge(req: Request, res: Response) {
  try {
    const { tenantId } = req.params;

    // Check access
    if (req.user?.role !== 'SUPER_ADMIN' && req.user?.tenantId !== tenantId) {
      return res.status(403).json({ success: false, error: 'Access denied' });
    }

    const entries = await prisma.knowledgeBaseEntry.findMany({
      where: { tenantId },
      orderBy: [{ category: 'asc' }, { priority: 'desc' }],
    });

    res.json({ success: true, entries });
  } catch (error) {
    console.error('List knowledge error:', error);
    res.status(500).json({ success: false, error: 'Failed to load knowledge base' });
  }
}

// Create knowledge base entry
export async function createKnowledge(req: Request, res: Response) {
  try {
    const { tenantId } = req.params;
    const { category, question, answer, keywords } = req.body;

    // Check access
    if (req.user?.role !== 'SUPER_ADMIN' && req.user?.tenantId !== tenantId) {
      return res.status(403).json({ success: false, error: 'Access denied' });
    }

    if (!question || !answer || !category) {
      return res.status(400).json({ success: false, error: 'Category, question, and answer required' });
    }

    const entry = await prisma.knowledgeBaseEntry.create({
      data: {
        tenantId,
        category,
        question,
        answer,
        keywords: keywords ? keywords.split(',').map((k: string) => k.trim()) : [],
      },
    });

    res.json({ success: true, entry });
  } catch (error) {
    console.error('Create knowledge error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({ success: false, error: `Failed to create entry: ${errorMessage}` });
  }
}

// Update knowledge base entry
export async function updateKnowledge(req: Request, res: Response) {
  try {
    const { tenantId, entryId } = req.params;
    const { category, question, answer, keywords, isActive, priority } = req.body;

    // Check access
    if (req.user?.role !== 'SUPER_ADMIN' && req.user?.tenantId !== tenantId) {
      return res.status(403).json({ success: false, error: 'Access denied' });
    }

    const entry = await prisma.knowledgeBaseEntry.update({
      where: { id: entryId },
      data: {
        category,
        question,
        answer,
        keywords: keywords ? keywords.split(',').map((k: string) => k.trim()) : undefined,
        isActive,
        priority,
      },
    });

    res.json({ success: true, entry });
  } catch (error) {
    console.error('Update knowledge error:', error);
    res.status(500).json({ success: false, error: 'Failed to update entry' });
  }
}

// Delete knowledge base entry
export async function deleteKnowledge(req: Request, res: Response) {
  try {
    const { tenantId, entryId } = req.params;

    // Check access
    if (req.user?.role !== 'SUPER_ADMIN' && req.user?.tenantId !== tenantId) {
      return res.status(403).json({ success: false, error: 'Access denied' });
    }

    await prisma.knowledgeBaseEntry.delete({
      where: { id: entryId },
    });

    res.json({ success: true });
  } catch (error) {
    console.error('Delete knowledge error:', error);
    res.status(500).json({ success: false, error: 'Failed to delete entry' });
  }
}

/**
 * Call Flow Management
 */

// List call flows
export async function listFlows(req: Request, res: Response) {
  try {
    const { tenantId } = req.params;

    // Check access
    if (req.user?.role !== 'SUPER_ADMIN' && req.user?.tenantId !== tenantId) {
      return res.status(403).json({ success: false, error: 'Access denied' });
    }

    const flows = await prisma.callFlow.findMany({
      where: { tenantId },
      orderBy: [{ priority: 'desc' }, { name: 'asc' }],
    });

    res.json({ success: true, flows });
  } catch (error) {
    console.error('List flows error:', error);
    res.status(500).json({ success: false, error: 'Failed to load call flows' });
  }
}

// Create call flow
export async function createFlow(req: Request, res: Response) {
  try {
    const { tenantId } = req.params;
    const { name, flowType, config, priority } = req.body;

    // Check access
    if (req.user?.role !== 'SUPER_ADMIN' && req.user?.tenantId !== tenantId) {
      return res.status(403).json({ success: false, error: 'Access denied' });
    }

    if (!name || !flowType) {
      return res.status(400).json({ success: false, error: 'Name and flow type required' });
    }

    const flow = await prisma.callFlow.create({
      data: {
        tenantId,
        name,
        flowType,
        config: config || {},
        priority: priority !== undefined ? priority : 0,
      },
    });

    res.json({ success: true, flow });
  } catch (error) {
    console.error('Create flow error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({ success: false, error: `Failed to create call flow: ${errorMessage}` });
  }
}

// Update call flow
export async function updateFlow(req: Request, res: Response) {
  try {
    const { tenantId, flowId } = req.params;
    const { name, flowType, config, isActive, priority } = req.body;

    // Check access
    if (req.user?.role !== 'SUPER_ADMIN' && req.user?.tenantId !== tenantId) {
      return res.status(403).json({ success: false, error: 'Access denied' });
    }

    const flow = await prisma.callFlow.update({
      where: { id: flowId },
      data: {
        name,
        flowType,
        config,
        isActive,
        priority,
      },
    });

    res.json({ success: true, flow });
  } catch (error) {
    console.error('Update flow error:', error);
    res.status(500).json({ success: false, error: 'Failed to update call flow' });
  }
}

// Delete call flow
export async function deleteFlow(req: Request, res: Response) {
  try {
    const { tenantId, flowId } = req.params;

    // Check access
    if (req.user?.role !== 'SUPER_ADMIN' && req.user?.tenantId !== tenantId) {
      return res.status(403).json({ success: false, error: 'Access denied' });
    }

    await prisma.callFlow.delete({
      where: { id: flowId },
    });

    res.json({ success: true });
  } catch (error) {
    console.error('Delete flow error:', error);
    res.status(500).json({ success: false, error: 'Failed to delete call flow' });
  }
}
