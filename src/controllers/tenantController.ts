import { Request, Response } from 'express';
import prisma from '../db/prisma';
import { leadService } from '../services/lead/leadService';
import {
  addHolidayForTenant,
  BusinessHourUpdate,
  deleteHolidayForTenant,
  saveBusinessHoursForTenant,
} from '../services/tenant/scheduleService';
import { getAllTimezones } from '../config/timezones';

/**
 * Tenant Dashboard
 */
export async function getDashboard(req: Request, res: Response) {
  try {
    if (!req.user || !req.user.tenantId) {
      return res.status(403).send('Forbidden');
    }

    const tenantId = req.user.tenantId;

    // Get stats for last 30 days
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const [
      totalCalls,
      completedCalls,
      transferredCalls,
      totalLeads,
      newLeads,
      avgCallDuration,
    ] = await Promise.all([
      prisma.callSession.count({
        where: {
          tenantId,
          startTime: { gte: thirtyDaysAgo },
        },
      }),
      prisma.callSession.count({
        where: {
          tenantId,
          status: 'COMPLETED',
          startTime: { gte: thirtyDaysAgo },
        },
      }),
      prisma.callSession.count({
        where: {
          tenantId,
          transferSuccess: true,
          startTime: { gte: thirtyDaysAgo },
        },
      }),
      prisma.lead.count({
        where: {
          tenantId,
          createdAt: { gte: thirtyDaysAgo },
        },
      }),
      prisma.lead.count({
        where: {
          tenantId,
          status: 'NEW',
          createdAt: { gte: thirtyDaysAgo },
        },
      }),
      prisma.callSession.aggregate({
        where: {
          tenantId,
          duration: { not: null },
          startTime: { gte: thirtyDaysAgo },
        },
        _avg: {
          duration: true,
        },
      }),
    ]);

    const stats = {
      totalCalls,
      completedCalls,
      transferredCalls,
      totalLeads,
      newLeads,
      avgCallDuration: Math.round(avgCallDuration._avg.duration || 0),
    };

    // Recent calls
    const recentCalls = await prisma.callSession.findMany({
      where: { tenantId },
      orderBy: { startTime: 'desc' },
      take: 10,
      include: {
        lead: true,
      },
    });

    res.render('tenant/dashboard', {
      user: req.user,
      tenant: req.tenant,
      stats,
      recentCalls,
    });
  } catch (error) {
    console.error('Tenant dashboard error:', error);
    res.status(500).send('Error loading dashboard');
  }
}

/**
 * List calls
 */
export async function getCalls(req: Request, res: Response) {
  try {
    if (!req.user || !req.user.tenantId) {
      return res.status(403).send('Forbidden');
    }

    const tenantId = req.user.tenantId;
    const page = parseInt(req.query.page as string) || 1;
    const limit = 50;
    const skip = (page - 1) * limit;

    const [calls, total] = await Promise.all([
      prisma.callSession.findMany({
        where: { tenantId },
        orderBy: { startTime: 'desc' },
        take: limit,
        skip,
        include: {
          lead: true,
          summary: true,
        },
      }),
      prisma.callSession.count({
        where: { tenantId },
      }),
    ]);

    res.render('tenant/calls', {
      user: req.user,
      tenant: req.tenant,
      calls,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('Get calls error:', error);
    res.status(500).send('Error loading calls');
  }
}

/**
 * Get call details
 */
export async function getCallDetail(req: Request, res: Response) {
  try {
    const { id } = req.params;

    const call = await prisma.callSession.findUnique({
      where: { id },
      include: {
        tenant: true,
        twilioNumber: true,
        events: {
          orderBy: { timestamp: 'asc' },
        },
        transcript: true,
        summary: true,
        lead: true,
        recordings: true,
      },
    });

    if (!call) {
      return res.status(404).send('Call not found');
    }

    // Check access
    if (req.user?.role !== 'SUPER_ADMIN' && call.tenantId !== req.user?.tenantId) {
      return res.status(403).send('Forbidden');
    }

    // Parse transcript turns
    let transcriptTurns = [];
    if (call.transcript) {
      try {
        transcriptTurns = JSON.parse(call.transcript.turns);
      } catch (e) {
        transcriptTurns = [];
      }
    }

    res.render('tenant/call-detail', {
      user: req.user,
      tenant: req.tenant,
      call,
      transcriptTurns,
    });
  } catch (error) {
    console.error('Get call detail error:', error);
    res.status(500).send('Error loading call');
  }
}

/**
 * List leads
 */
export async function getLeads(req: Request, res: Response) {
  try {
    if (!req.user || !req.user.tenantId) {
      return res.status(403).send('Forbidden');
    }

    const tenantId = req.user.tenantId;
    const status = req.query.status as string | undefined;

    const leads = await leadService.getLeads(tenantId, {
      status,
      limit: 100,
    });

    const leadStats = await leadService.getLeadStats(tenantId);

    res.render('tenant/leads', {
      user: req.user,
      tenant: req.tenant,
      leads,
      leadStats,
      filterStatus: status,
    });
  } catch (error) {
    console.error('Get leads error:', error);
    res.status(500).send('Error loading leads');
  }
}

/**
 * Get lead detail
 */
export async function getLeadDetail(req: Request, res: Response) {
  try {
    const { id } = req.params;

    const lead = await leadService.getLeadById(id);

    if (!lead) {
      return res.status(404).send('Lead not found');
    }

    // Check access
    if (req.user?.role !== 'SUPER_ADMIN' && lead.tenantId !== req.user?.tenantId) {
      return res.status(403).send('Forbidden');
    }

    res.render('tenant/lead-detail', {
      user: req.user,
      tenant: req.tenant,
      lead,
    });
  } catch (error) {
    console.error('Get lead detail error:', error);
    res.status(500).send('Error loading lead');
  }
}

/**
 * Update lead
 */
export async function updateLead(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const { status, notes } = req.body;

    if (status) {
      await leadService.updateLeadStatus(id, status);
    }

    if (notes) {
      await leadService.addLeadNotes(id, notes);
    }

    res.redirect(`/tenant/leads/${id}`);
  } catch (error) {
    console.error('Update lead error:', error);
    res.status(500).send('Error updating lead');
  }
}

/**
 * Export leads as CSV
 */
export async function exportLeads(req: Request, res: Response) {
  try {
    if (!req.user || !req.user.tenantId) {
      return res.status(403).send('Forbidden');
    }

    const tenantId = req.user.tenantId;
    const { status, startDate, endDate } = req.query;

    const options: any = {};
    if (status) options.status = status as string;
    if (startDate) options.startDate = new Date(startDate as string);
    if (endDate) options.endDate = new Date(endDate as string);

    const csv = await leadService.exportLeadsToCSV(tenantId, options);

    const filename = `leads-${new Date().toISOString().split('T')[0]}.csv`;
    
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(csv);
  } catch (error) {
    console.error('Export leads error:', error);
    res.status(500).send('Error exporting leads');
  }
}

/**
 * Settings page
 */
export async function getSettings(req: Request, res: Response) {
  try {
    if (!req.user || !req.user.tenantId) {
      return res.status(403).send('Forbidden');
    }

    const tenantId = req.user.tenantId;

    const [
      tenant,
      config,
      businessHours,
      holidayHours,
      departments,
      transferTargets,
      knowledgeBase,
    ] = await Promise.all([
      prisma.tenant.findUnique({ where: { id: tenantId } }),
      prisma.receptionistConfig.findUnique({ where: { tenantId } }),
      prisma.businessHours.findMany({
        where: { tenantId },
        orderBy: { dayOfWeek: 'asc' },
      }),
      prisma.holidayHours.findMany({
        where: { tenantId },
        orderBy: { date: 'asc' },
      }),
      prisma.department.findMany({ where: { tenantId } }),
      prisma.transferTarget.findMany({
        where: { tenantId },
        include: { department: true },
        orderBy: { priority: 'asc' },
      }),
      prisma.knowledgeBaseEntry.findMany({
        where: { tenantId },
        orderBy: { priority: 'desc' },
      }),
    ]);

    const timezones = getAllTimezones();

    res.render('tenant/settings', {
      user: req.user,
      tenant: req.tenant,
      config,
      businessHours,
      holidayHours,
      departments,
      transferTargets,
      knowledgeBase,
      timezones,
    });
  } catch (error) {
    console.error('Get settings error:', error);
    res.status(500).send('Error loading settings');
  }
}

/**
 * Update receptionist config
 */
export async function updateReceptionistConfig(req: Request, res: Response) {
  try {
    if (!req.user || !req.user.tenantId) {
      return res.status(403).send('Forbidden');
    }

    const tenantId = req.user.tenantId;
    const {
      greetingMessage,
      personality,
      transferPrompt,
      leadCapturePrompt,
      fallbackMessage,
      endCallMessage,
      menuOptionDelaySeconds,
    } = req.body;

    const delaySeconds = Number(menuOptionDelaySeconds);
    const menuOptionDelayMs = Number.isFinite(delaySeconds)
      ? Math.max(0, Math.min(60, delaySeconds)) * 1000
      : 2000;

    await prisma.receptionistConfig.upsert({
      where: { tenantId },
      update: {
        greetingMessage,
        personality,
        transferPrompt,
        leadCapturePrompt,
        fallbackMessage,
        endCallMessage,
        menuOptionDelayMs,
      },
      create: {
        tenantId,
        greetingMessage,
        personality,
        transferPrompt,
        leadCapturePrompt,
        fallbackMessage,
        endCallMessage,
        menuOptionDelayMs,
      },
    });

    res.redirect('/tenant/settings');
  } catch (error) {
    console.error('Update config error:', error);
    res.status(500).send('Error updating configuration');
  }
}

/**
 * Add knowledge base entry
 */
export async function addKnowledgeEntry(req: Request, res: Response) {
  try {
    if (!req.user || !req.user.tenantId) {
      return res.status(403).send('Forbidden');
    }

    const tenantId = req.user.tenantId;
    const { category, question, answer, keywords } = req.body;

    const keywordsArray = keywords.split(',').map((k: string) => k.trim());

    await prisma.knowledgeBaseEntry.create({
      data: {
        tenantId,
        category,
        question,
        answer,
        keywords: keywordsArray,
        isActive: true,
      },
    });

    res.redirect('/tenant/settings');
  } catch (error) {
    console.error('Add knowledge entry error:', error);
    res.status(500).send('Error adding knowledge entry');
  }
}

/**
 * Add transfer target
 */
export async function addTransferTarget(req: Request, res: Response) {
  try {
    if (!req.user || !req.user.tenantId) {
      return res.status(403).send('Forbidden');
    }

    const tenantId = req.user.tenantId;
    const { name, phoneNumber, departmentId, priority } = req.body;

    await prisma.transferTarget.create({
      data: {
        tenantId,
        name,
        phoneNumber,
        departmentId: departmentId || null,
        priority: parseInt(priority) || 1,
        isActive: true,
      },
    });

    res.redirect('/tenant/settings');
  } catch (error) {
    console.error('Add transfer target error:', error);
    res.status(500).send('Error adding transfer target');
  }
}

/**
 * Update weekly business hours
 */
export async function updateBusinessHours(req: Request, res: Response) {
  try {
    if (!req.user || !req.user.tenantId) {
      return res.status(403).send('Forbidden');
    }

    const tenantId = req.user.tenantId;
    const timezone = (req.body.timezone as string | undefined) || undefined;

    const hours: BusinessHourUpdate[] = [];
    for (let day = 0; day < 7; day++) {
      const isOpen = req.body[`day_${day}_isOpen`] === 'on';
      const openTime = (req.body[`day_${day}_openTime`] as string) || '09:00';
      const closeTime = (req.body[`day_${day}_closeTime`] as string) || '17:00';
      hours.push({ dayOfWeek: day, isOpen, openTime, closeTime });
    }

    await saveBusinessHoursForTenant(tenantId, hours, timezone);

    res.redirect('/tenant/settings#business-hours');
  } catch (error) {
    console.error('Update business hours error:', error);
    res.status(400).send(
      error instanceof Error ? error.message : 'Failed to update business hours'
    );
  }
}

/**
 * Add a holiday override
 */
export async function addHoliday(req: Request, res: Response) {
  try {
    if (!req.user || !req.user.tenantId) {
      return res.status(403).send('Forbidden');
    }

    const tenantId = req.user.tenantId;
    const { name, date, isClosed, openTime, closeTime } = req.body;

    if (!name || !date) {
      return res.status(400).send('Holiday name and date are required');
    }

    const parsedDate = new Date(`${date}T00:00:00`);
    const closed = isClosed === 'on';

    if (!closed && (!openTime || !closeTime)) {
      return res.status(400).send('Open and close times are required for partial-day holidays');
    }

    await addHolidayForTenant(tenantId, {
      name,
      date: parsedDate,
      isClosed: closed,
      openTime: closed ? null : openTime,
      closeTime: closed ? null : closeTime,
    });

    res.redirect('/tenant/settings#holiday-hours');
  } catch (error) {
    console.error('Add holiday error:', error);
    res.status(400).send(error instanceof Error ? error.message : 'Failed to add holiday');
  }
}

/**
 * Delete holiday override
 */
export async function deleteHoliday(req: Request, res: Response) {
  try {
    if (!req.user || !req.user.tenantId) {
      return res.status(403).send('Forbidden');
    }

    const tenantId = req.user.tenantId;
    const { holidayId } = req.params;

    await deleteHolidayForTenant(tenantId, holidayId);

    res.redirect('/tenant/settings#holiday-hours');
  } catch (error) {
    console.error('Delete holiday error:', error);
    res.status(400).send('Failed to delete holiday');
  }
}

/**
 * Analytics Page
 */
export async function getAnalytics(req: Request, res: Response) {
  try {
    const user = req.user!;
    const tenantId = user.tenantId!;

    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
    });

    if (!tenant) {
      return res.status(404).send('Tenant not found');
    }

    res.render('tenant/analytics', {
      user,
      tenant,
    });
  } catch (error) {
    console.error('Analytics page error:', error);
    res.status(500).send('Error loading analytics');
  }
}
