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
          customFields: {
            orderBy: { order: 'asc' },
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
          customFields: {
            orderBy: { order: 'asc' },
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

  /**
   * Export leads as CSV
   */
  async exportLeadsToCSV(tenantId: string, options?: {
    status?: string;
    startDate?: Date;
    endDate?: Date;
  }): Promise<string> {
    try {
      const where: any = { tenantId };
      
      if (options?.status) {
        where.status = options.status;
      }

      if (options?.startDate || options?.endDate) {
        where.createdAt = {};
        if (options.startDate) where.createdAt.gte = options.startDate;
        if (options.endDate) where.createdAt.lte = options.endDate;
      }

      const leads = await prisma.lead.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        include: {
          customFields: {
            orderBy: { order: 'asc' },
          },
          callSession: {
            select: {
              callSid: true,
              fromNumber: true,
              startTime: true,
              duration: true,
            },
          },
        },
      });

      if (leads.length === 0) {
        return 'No leads found';
      }

      // Collect all unique custom field labels
      const customFieldLabels = new Set<string>();
      leads.forEach(lead => {
        lead.customFields.forEach(field => {
          customFieldLabels.add(field.label);
        });
      });

      // Create CSV header
      const baseHeaders = ['Created At', 'Status', 'Name', 'Phone', 'Email', 'Reason', 'Source', 'Call Duration (s)', 'Notes'];
      const customHeaders = Array.from(customFieldLabels);
      const headers = [...baseHeaders, ...customHeaders];
      
      let csv = headers.map(h => `"${h}"`).join(',') + '\n';

      // Add rows
      for (const lead of leads) {
        const row: string[] = [
          lead.createdAt.toISOString(),
          lead.status,
          lead.name || '',
          lead.phone || '',
          lead.email || '',
          lead.reason || '',
          lead.source,
          lead.callSession?.duration?.toString() || '',
          lead.notes || '',
        ];

        // Add custom field values
        for (const label of customHeaders) {
          const field = lead.customFields.find(f => f.label === label);
          row.push(field?.value || '');
        }

        csv += row.map(cell => `"${(cell || '').replace(/"/g, '""')}"`).join(',') + '\n';
      }

      return csv;
    } catch (error) {
      console.error('Error exporting leads to CSV:', error);
      throw error;
    }
  }
}

export const leadService = new LeadService();
