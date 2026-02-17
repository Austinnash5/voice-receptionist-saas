import { prisma } from '../../db/prisma';
import { Prisma } from '@prisma/client';

export interface DealFilters {
  search?: string;
  status?: string;
  pipelineId?: string;
  stageId?: string;
  ownerId?: string;
  contactId?: string;
  companyId?: string;
  valueMin?: number;
  valueMax?: number;
  expectedCloseDateFrom?: Date;
  expectedCloseDateTo?: Date;
}

export interface DealCreateData {
  title: string;
  pipelineId: string;
  stageId: string;
  contactId?: string;
  companyId?: string;
  ownerId?: string;
  value?: number;
  currency?: string;
  description?: string;
  probability?: number;
  expectedCloseDate?: Date;
  customFields?: any;
}

export class DealService {
  /**
   * Get paginated deals with filters
   */
  async getDeals(
    tenantId: string,
    page: number = 1,
    limit: number = 50,
    filters: DealFilters = {}
  ) {
    const skip = (page - 1) * limit;

    const where: Prisma.DealWhereInput = {
      tenantId,
    };

    if (filters.search) {
      where.OR = [
        { title: { contains: filters.search, mode: 'insensitive' } },
        { description: { contains: filters.search, mode: 'insensitive' } },
      ];
    }

    if (filters.status) where.status = filters.status as any;
    if (filters.pipelineId) where.pipelineId = filters.pipelineId;
    if (filters.stageId) where.stageId = filters.stageId;
    if (filters.ownerId) where.ownerId = filters.ownerId;
    if (filters.contactId) where.contactId = filters.contactId;
    if (filters.companyId) where.companyId = filters.companyId;

    if (filters.valueMin !== undefined || filters.valueMax !== undefined) {
      where.value = {};
      if (filters.valueMin !== undefined) where.value.gte = filters.valueMin;
      if (filters.valueMax !== undefined) where.value.lte = filters.valueMax;
    }

    if (filters.expectedCloseDateFrom || filters.expectedCloseDateTo) {
      where.expectedCloseDate = {};
      if (filters.expectedCloseDateFrom)
        where.expectedCloseDate.gte = filters.expectedCloseDateFrom;
      if (filters.expectedCloseDateTo)
        where.expectedCloseDate.lte = filters.expectedCloseDateTo;
    }

    const total = await prisma.deal.count({ where });

    const deals = await prisma.deal.findMany({
      where,
      include: {
        pipeline: true,
        stage: true,
        contact: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            fullName: true,
            email: true,
          },
        },
        company: {
          select: {
            id: true,
            name: true,
          },
        },
        owner: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
        _count: {
          select: {
            tasks: true,
            notes: true,
          },
        },
      },
      skip,
      take: limit,
      orderBy: { createdAt: 'desc' },
    });

    return {
      deals,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Get deal by ID
   */
  async getDealById(dealId: string, tenantId: string) {
    return prisma.deal.findFirst({
      where: {
        id: dealId,
        tenantId,
      },
      include: {
        pipeline: true,
        stage: true,
        contact: true,
        company: true,
        owner: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
        tasks: {
          include: {
            assignee: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
              },
            },
          },
          orderBy: {
            dueDate: 'asc',
          },
        },
        notes: {
          include: {
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
              },
            },
          },
          orderBy: {
            createdAt: 'desc',
          },
        },
        activities: {
          include: {
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
              },
            },
          },
          orderBy: {
            occurredAt: 'desc',
          },
        },
      },
    });
  }

  /**
   * Create deal
   */
  async createDeal(tenantId: string, userId: string, data: DealCreateData) {
    const deal = await prisma.deal.create({
      data: {
        tenantId,
        title: data.title,
        pipelineId: data.pipelineId,
        stageId: data.stageId,
        contactId: data.contactId,
        companyId: data.companyId,
        ownerId: data.ownerId,
        value: data.value,
        currency: data.currency || 'USD',
        description: data.description,
        probability: data.probability || 0,
        expectedCloseDate: data.expectedCloseDate,
        customFields: data.customFields,
      },
      include: {
        pipeline: true,
        stage: true,
        contact: true,
        company: true,
        owner: true,
      },
    });

    // Log activity
    await prisma.activity.create({
      data: {
        tenantId,
        dealId: deal.id,
        contactId: deal.contactId,
        companyId: deal.companyId,
        createdBy: userId,
        activityType: 'DEAL_CREATED',
        title: `Deal created: ${deal.title}`,
        metadata: { dealValue: deal.value, stage: deal.stage.name },
      },
    });

    return deal;
  }

  /**
   * Update deal
   */
  async updateDeal(
    dealId: string,
    tenantId: string,
    userId: string,
    data: Partial<DealCreateData>
  ) {
    const existingDeal = await prisma.deal.findFirst({
      where: { id: dealId, tenantId },
      include: { stage: true },
    });

    if (!existingDeal) throw new Error('Deal not found');

    const deal = await prisma.deal.update({
      where: { id: dealId },
      data,
      include: {
        pipeline: true,
        stage: true,
        contact: true,
        company: true,
        owner: true,
      },
    });

    // Log stage change activity
    if (data.stageId && data.stageId !== existingDeal.stageId) {
      await prisma.activity.create({
        data: {
          tenantId,
          dealId: deal.id,
          contactId: deal.contactId,
          companyId: deal.companyId,
          createdBy: userId,
          activityType: 'DEAL_UPDATED',
          title: `Deal moved to ${deal.stage.name}`,
          description: `From ${existingDeal.stage.name} to ${deal.stage.name}`,
        },
      });
    }

    return deal;
  }

  /**
   * Mark deal as won
   */
  async winDeal(dealId: string, tenantId: string, userId: string) {
    const deal = await prisma.deal.update({
      where: { id: dealId },
      data: {
        status: 'WON',
        actualCloseDate: new Date(),
      },
      include: {
        contact: true,
        pipeline: true,
        stage: true,
      },
    });

    // Update contact lifecycle to CUSTOMER
    if (deal.contactId) {
      await prisma.contact.update({
        where: { id: deal.contactId },
        data: { lifecycle: 'CUSTOMER' },
      });
    }

    // Log activity
    await prisma.activity.create({
      data: {
        tenantId,
        dealId: deal.id,
        contactId: deal.contactId,
        companyId: deal.companyId,
        createdBy: userId,
        activityType: 'DEAL_WON',
        title: `Deal won: ${deal.title}`,
        metadata: { dealValue: deal.value },
      },
    });

    return deal;
  }

  /**
   * Mark deal as lost
   */
  async loseDeal(
    dealId: string,
    tenantId: string,
    userId: string,
    lostReason?: string
  ) {
    const deal = await prisma.deal.update({
      where: { id: dealId },
      data: {
        status: 'LOST',
        actualCloseDate: new Date(),
        lostReason,
      },
      include: {
        contact: true,
        pipeline: true,
        stage: true,
      },
    });

    // Update contact lifecycle to LOST
    if (deal.contactId) {
      await prisma.contact.update({
        where: { id: deal.contactId },
        data: { lifecycle: 'LOST' },
      });
    }

    // Log activity
    await prisma.activity.create({
      data: {
        tenantId,
        dealId: deal.id,
        contactId: deal.contactId,
        companyId: deal.companyId,
        createdBy: userId,
        activityType: 'DEAL_LOST',
        title: `Deal lost: ${deal.title}`,
        description: lostReason,
      },
    });

    return deal;
  }

  /**
   * Get pipeline view (deals grouped by stage)
   */
  async getPipelineView(tenantId: string, pipelineId: string) {
    const pipeline = await prisma.pipeline.findFirst({
      where: {
        id: pipelineId,
        tenantId,
      },
      include: {
        stages: {
          orderBy: { order: 'asc' },
        },
      },
    });

    if (!pipeline) throw new Error('Pipeline not found');

    const dealsByStage = await Promise.all(
      pipeline.stages.map(async (stage) => {
        const deals = await prisma.deal.findMany({
          where: {
            tenantId,
            pipelineId,
            stageId: stage.id,
            status: 'OPEN',
          },
          include: {
            contact: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                fullName: true,
              },
            },
            company: {
              select: {
                id: true,
                name: true,
              },
            },
            owner: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
              },
            },
          },
          orderBy: { createdAt: 'desc' },
        });

        const totalValue = deals.reduce(
          (sum, deal) => sum + (Number(deal.value) || 0),
          0
        );

        return {
          stage,
          deals,
          count: deals.length,
          totalValue,
        };
      })
    );

    return {
      pipeline,
      stages: dealsByStage,
    };
  }

  /**
   * Get deal statistics
   */
  async getDealStats(tenantId: string) {
    const [open, won, lost, totalValue, avgDealValue] = await Promise.all([
      prisma.deal.count({
        where: { tenantId, status: 'OPEN' },
      }),
      prisma.deal.count({
        where: { tenantId, status: 'WON' },
      }),
      prisma.deal.count({
        where: { tenantId, status: 'LOST' },
      }),
      prisma.deal.aggregate({
        where: { tenantId, status: 'OPEN' },
        _sum: { value: true },
      }),
      prisma.deal.aggregate({
        where: { tenantId, status: 'OPEN' },
        _avg: { value: true },
      }),
    ]);

    return {
      open,
      won,
      lost,
      totalValue: totalValue._sum.value || 0,
      avgDealValue: avgDealValue._avg.value || 0,
    };
  }

  /**
   * Initialize default pipeline for tenant
   */
  async initializeDefaultPipeline(tenantId: string) {
    const pipeline = await prisma.pipeline.create({
      data: {
        tenantId,
        name: 'Sales Pipeline',
        description: 'Default sales pipeline',
        isDefault: true,
        stages: {
          create: [
            { name: 'Prospecting', order: 1, probability: 10, isDefault: true },
            { name: 'Qualification', order: 2, probability: 25 },
            { name: 'Proposal', order: 3, probability: 50 },
            { name: 'Negotiation', order: 4, probability: 75 },
            { name: 'Closed Won', order: 5, probability: 100 },
          ],
        },
      },
      include: {
        stages: true,
      },
    });

    return pipeline;
  }
}

export const dealService = new DealService();
