import prisma from '../../db/prisma';
import { LeadStatus } from '@prisma/client';

export class LeadService {
  /**
   * Create a new lead
   */
  async createLead(params: {
    tenantId: string;
    callSessionId?: string;
    name?: string;
    phone?: string;
    email?: string;
    reason?: string;
    callbackPreference?: string;
    source?: string;
  }) {
    try {
      const lead = await prisma.lead.create({
        data: {
          tenantId: params.tenantId,
          callSessionId: params.callSessionId,
          name: params.name,
          phone: params.phone,
          email: params.email,
          reason: params.reason,
          callbackPreference: params.callbackPreference || 'phone',
          status: 'NEW',
          source: params.source || 'voice_call',
        },
      });

      return lead;
    } catch (error) {
      console.error('Error creating lead:', error);
      throw error;
    }
  }

  /**
   * Get leads for a tenant
   */
  async getLeads(
    tenantId: string,
    options?: {
      status?: string;
      limit?: number;
      offset?: number;
    }
  ) {
    try {
      const where: any = { tenantId };
      
      if (options?.status) {
        where.status = options.status;
      }

      const leads = await prisma.lead.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: options?.limit || 50,
        skip: options?.offset || 0,
        include: {
          callSession: {
            select: {
              callSid: true,
              fromNumber: true,
              startTime: true,
            },
          },
        },
      });

      return leads;
    } catch (error) {
      console.error('Error fetching leads:', error);
      return [];
    }
  }

  /**
   * Get lead by ID
   */
  async getLeadById(leadId: string) {
    try {
      return await prisma.lead.findUnique({
        where: { id: leadId },
        include: {
          callSession: {
            include: {
              transcript: true,
              summary: true,
            },
          },
        },
      });
    } catch (error) {
      console.error('Error fetching lead:', error);
      return null;
    }
  }

  /**
   * Update lead status
   */
  async updateLeadStatus(leadId: string, status: string) {
    try {
      return await prisma.lead.update({
        where: { id: leadId },
        data: { status: status as LeadStatus },
      });
    } catch (error) {
      console.error('Error updating lead status:', error);
      throw error;
    }
  }

  /**
   * Add notes to lead
   */
  async addLeadNotes(leadId: string, notes: string) {
    try {
      return await prisma.lead.update({
        where: { id: leadId },
        data: { notes },
      });
    } catch (error) {
      console.error('Error adding lead notes:', error);
      throw error;
    }
  }

  /**
   * Get lead stats for tenant
   */
  async getLeadStats(tenantId: string, startDate?: Date, endDate?: Date) {
    try {
      const where: any = { tenantId };

      if (startDate || endDate) {
        where.createdAt = {};
        if (startDate) where.createdAt.gte = startDate;
        if (endDate) where.createdAt.lte = endDate;
      }

      const [total, newLeads, contacted, qualified, converted] = await Promise.all([
        prisma.lead.count({ where }),
        prisma.lead.count({ where: { ...where, status: 'NEW' } }),
        prisma.lead.count({ where: { ...where, status: 'CONTACTED' } }),
        prisma.lead.count({ where: { ...where, status: 'QUALIFIED' } }),
        prisma.lead.count({ where: { ...where, status: 'CONVERTED' } }),
      ]);

      return {
        total,
        new: newLeads,
        contacted,
        qualified,
        converted,
      };
    } catch (error) {
      console.error('Error fetching lead stats:', error);
      return {
        total: 0,
        new: 0,
        contacted: 0,
        qualified: 0,
        converted: 0,
      };
    }
  }
}

export const leadService = new LeadService();
