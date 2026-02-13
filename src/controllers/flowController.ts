import { Request, Response } from 'express';
import prisma from '../db/prisma';
import { FlowConfig } from '../services/call/flowExecutor';

/**
 * Get all flows for a tenant
 */
export async function getFlows(req: Request, res: Response) {
  try {
    const { tenantId } = req.params;

    const flows = await prisma.callFlow.findMany({
      where: { tenantId },
      orderBy: [
        { flowType: 'asc' },
        { priority: 'desc' },
      ],
    });

    res.json(flows);
  } catch (error) {
    console.error('Get flows error:', error);
    res.status(500).json({ error: 'Failed to fetch flows' });
  }
}

/**
 * Get a single flow by ID
 */
export async function getFlow(req: Request, res: Response) {
  try {
    const { flowId } = req.params;

    const flow = await prisma.callFlow.findUnique({
      where: { id: flowId },
    });

    if (!flow) {
      return res.status(404).json({ error: 'Flow not found' });
    }

    res.json(flow);
  } catch (error) {
    console.error('Get flow error:', error);
    res.status(500).json({ error: 'Failed to fetch flow' });
  }
}

/**
 * Create a new flow
 */
export async function createFlow(req: Request, res: Response) {
  try {
    const { tenantId } = req.params;
    const { name, flowType, priority, isActive, config } = req.body;

    // Validate required fields
    if (!name || !flowType || !config) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Validate config structure
    const flowConfig = config as FlowConfig;
    if (!flowConfig.steps || !flowConfig.entryPoint) {
      return res.status(400).json({ error: 'Invalid flow configuration' });
    }

    const flow = await prisma.callFlow.create({
      data: {
        tenantId,
        name,
        flowType,
        priority: priority || 0,
        isActive: isActive !== undefined ? isActive : true,
        config,
      },
    });

    res.status(201).json(flow);
  } catch (error) {
    console.error('Create flow error:', error);
    res.status(500).json({ error: 'Failed to create flow' });
  }
}

/**
 * Update an existing flow
 */
export async function updateFlow(req: Request, res: Response) {
  try {
    const { flowId } = req.params;
    const { name, flowType, priority, isActive, config } = req.body;

    // Check if flow exists
    const existingFlow = await prisma.callFlow.findUnique({
      where: { id: flowId },
    });

    if (!existingFlow) {
      return res.status(404).json({ error: 'Flow not found' });
    }

    // Validate config if provided
    if (config) {
      const flowConfig = config as FlowConfig;
      if (!flowConfig.steps || !flowConfig.entryPoint) {
        return res.status(400).json({ error: 'Invalid flow configuration' });
      }
    }

    const updatedFlow = await prisma.callFlow.update({
      where: { id: flowId },
      data: {
        ...(name && { name }),
        ...(flowType && { flowType }),
        ...(priority !== undefined && { priority }),
        ...(isActive !== undefined && { isActive }),
        ...(config && { config }),
      },
    });

    res.json(updatedFlow);
  } catch (error) {
    console.error('Update flow error:', error);
    res.status(500).json({ error: 'Failed to update flow' });
  }
}

/**
 * Delete a flow
 */
export async function deleteFlow(req: Request, res: Response) {
  try {
    const { flowId } = req.params;

    await prisma.callFlow.delete({
      where: { id: flowId },
    });

    res.json({ success: true });
  } catch (error) {
    console.error('Delete flow error:', error);
    res.status(500).json({ error: 'Failed to delete flow' });
  }
}

/**
 * Toggle flow active status
 */
export async function toggleFlowStatus(req: Request, res: Response) {
  try {
    const { flowId } = req.params;

    const flow = await prisma.callFlow.findUnique({
      where: { id: flowId },
    });

    if (!flow) {
      return res.status(404).json({ error: 'Flow not found' });
    }

    const updatedFlow = await prisma.callFlow.update({
      where: { id: flowId },
      data: { isActive: !flow.isActive },
    });

    res.json(updatedFlow);
  } catch (error) {
    console.error('Toggle flow status error:', error);
    res.status(500).json({ error: 'Failed to toggle flow status' });
  }
}

/**
 * Duplicate a flow
 */
export async function duplicateFlow(req: Request, res: Response) {
  try {
    const { flowId } = req.params;

    const originalFlow = await prisma.callFlow.findUnique({
      where: { id: flowId },
    });

    if (!originalFlow) {
      return res.status(404).json({ error: 'Flow not found' });
    }

    const duplicatedFlow = await prisma.callFlow.create({
      data: {
        tenantId: originalFlow.tenantId,
        name: `${originalFlow.name} (Copy)`,
        flowType: originalFlow.flowType,
        priority: originalFlow.priority,
        isActive: false, // Start as inactive
        config: originalFlow.config as any,
      },
    });

    res.status(201).json(duplicatedFlow);
  } catch (error) {
    console.error('Duplicate flow error:', error);
    res.status(500).json({ error: 'Failed to duplicate flow' });
  }
}
