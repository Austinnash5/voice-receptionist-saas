import { prisma } from '../../db/prisma';
import { CallStatus } from '@prisma/client';

interface DateRange {
  startDate: Date;
  endDate: Date;
}

interface CallVolumeData {
  date: string;
  total: number;
  completed: number;
  failed: number;
}

interface CallMetrics {
  totalCalls: number;
  completedCalls: number;
  failedCalls: number;
  averageDuration: number;
  totalMinutes: number;
  leadsGenerated: number;
  transferAttempts: number;
  successfulTransfers: number;
}

interface PeakHoursData {
  hour: number;
  count: number;
}

interface TopFAQData {
  question: string;
  count: number;
}

interface LeadConversionData {
  totalCalls: number;
  leadsGenerated: number;
  conversionRate: number;
}

export class AnalyticsService {
  /**
   * Get call metrics for a tenant within a date range
   */
  async getCallMetrics(tenantId: string, dateRange?: DateRange): Promise<CallMetrics> {
    const where: any = { tenantId };
    
    if (dateRange) {
      where.startTime = {
        gte: dateRange.startDate,
        lte: dateRange.endDate,
      };
    }

    const calls = await prisma.callSession.findMany({
      where,
      select: {
        status: true,
        duration: true,
        leadCaptured: true,
        transferAttempted: true,
        transferSuccess: true,
      },
    });

    const totalCalls = calls.length;
    const completedCalls = calls.filter(c => c.status === CallStatus.COMPLETED).length;
    const failedCalls = calls.filter(c => c.status === CallStatus.FAILED).length;
    const leadsGenerated = calls.filter(c => c.leadCaptured).length;
    const transferAttempts = calls.filter(c => c.transferAttempted).length;
    const successfulTransfers = calls.filter(c => c.transferSuccess).length;

    // Calculate average duration (only for completed calls with duration)
    const callsWithDuration = calls.filter(c => c.duration && c.duration > 0);
    const totalDuration = callsWithDuration.reduce((sum, c) => sum + (c.duration || 0), 0);
    const averageDuration = callsWithDuration.length > 0 
      ? Math.round(totalDuration / callsWithDuration.length) 
      : 0;
    const totalMinutes = Math.round(totalDuration / 60);

    return {
      totalCalls,
      completedCalls,
      failedCalls,
      averageDuration,
      totalMinutes,
      leadsGenerated,
      transferAttempts,
      successfulTransfers,
    };
  }

  /**
   * Get call volume data over time (daily aggregation)
   */
  async getCallVolumeOverTime(tenantId: string, dateRange: DateRange): Promise<CallVolumeData[]> {
    const calls = await prisma.callSession.findMany({
      where: {
        tenantId,
        startTime: {
          gte: dateRange.startDate,
          lte: dateRange.endDate,
        },
      },
      select: {
        startTime: true,
        status: true,
      },
      orderBy: {
        startTime: 'asc',
      },
    });

    // Group by date
    const groupedByDate = new Map<string, { total: number; completed: number; failed: number }>();

    calls.forEach(call => {
      const dateKey = call.startTime.toISOString().split('T')[0]; // YYYY-MM-DD
      
      if (!groupedByDate.has(dateKey)) {
        groupedByDate.set(dateKey, { total: 0, completed: 0, failed: 0 });
      }

      const stats = groupedByDate.get(dateKey)!;
      stats.total++;
      
      if (call.status === CallStatus.COMPLETED) {
        stats.completed++;
      } else if (call.status === CallStatus.FAILED) {
        stats.failed++;
      }
    });

    // Convert to array and sort
    return Array.from(groupedByDate.entries())
      .map(([date, stats]) => ({
        date,
        ...stats,
      }))
      .sort((a, b) => a.date.localeCompare(b.date));
  }

  /**
   * Get peak hours analysis
   */
  async getPeakHours(tenantId: string, dateRange?: DateRange): Promise<PeakHoursData[]> {
    const where: any = { tenantId };
    
    if (dateRange) {
      where.startTime = {
        gte: dateRange.startDate,
        lte: dateRange.endDate,
      };
    }

    const calls = await prisma.callSession.findMany({
      where,
      select: {
        startTime: true,
      },
    });

    // Group by hour (0-23)
    const hourCounts = new Array(24).fill(0);
    
    calls.forEach(call => {
      const hour = call.startTime.getHours();
      hourCounts[hour]++;
    });

    return hourCounts.map((count, hour) => ({
      hour,
      count,
    }));
  }

  /**
   * Get top FAQ questions
   */
  async getTopFAQs(tenantId: string, dateRange?: DateRange, limit: number = 10): Promise<TopFAQData[]> {
    const where: any = { tenantId };
    
    if (dateRange) {
      where.createdAt = {
        gte: dateRange.startDate,
        lte: dateRange.endDate,
      };
    }

    // Get call events where FAQ was searched
    const faqEvents = await prisma.callEvent.findMany({
      where: {
        ...where,
        eventType: 'FAQ_SEARCH',
      },
      select: {
        data: true,
      },
    });

    // Count FAQ questions
    const faqCounts = new Map<string, number>();

    faqEvents.forEach(event => {
      try {
        const metadata = JSON.parse(event.data);
        const question = metadata?.question || metadata?.query;
        
        if (question) {
          faqCounts.set(question, (faqCounts.get(question) || 0) + 1);
        }
      } catch (e) {
        // Skip invalid JSON
      }
    });

    // Convert to array, sort, and limit
    return Array.from(faqCounts.entries())
      .map(([question, count]) => ({ question, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, limit);
  }

  /**
   * Get lead conversion data
   */
  async getLeadConversion(tenantId: string, dateRange?: DateRange): Promise<LeadConversionData> {
    const where: any = { tenantId };
    
    if (dateRange) {
      where.startTime = {
        gte: dateRange.startDate,
        lte: dateRange.endDate,
      };
    }

    const [totalCalls, leadsGenerated] = await Promise.all([
      prisma.callSession.count({ where }),
      prisma.callSession.count({ 
        where: { 
          ...where, 
          leadCaptured: true 
        } 
      }),
    ]);

    const conversionRate = totalCalls > 0 
      ? Math.round((leadsGenerated / totalCalls) * 100) 
      : 0;

    return {
      totalCalls,
      leadsGenerated,
      conversionRate,
    };
  }

  /**
   * Get flow performance metrics
   */
  async getFlowPerformance(tenantId: string, dateRange?: DateRange) {
    const where: any = { tenantId };
    
    if (dateRange) {
      where.startTime = {
        gte: dateRange.startDate,
        lte: dateRange.endDate,
      };
    }

    const calls = await prisma.callSession.findMany({
      where,
      select: {
        metadata: true,
      },
    });

    // Count flow usage and menu selections
    const flowUsage = new Map<string, number>();
    const menuSelections = new Map<string, number>();

    calls.forEach(call => {
      const metadata = call.metadata as any;
      
      if (metadata?.flowType) {
        flowUsage.set(metadata.flowType, (flowUsage.get(metadata.flowType) || 0) + 1);
      }

      if (metadata?.lastSelection) {
        const selection = `${metadata.currentStepId || 'unknown'}: ${metadata.lastSelection}`;
        menuSelections.set(selection, (menuSelections.get(selection) || 0) + 1);
      }
    });

    return {
      flowUsage: Array.from(flowUsage.entries()).map(([type, count]) => ({ type, count })),
      menuSelections: Array.from(menuSelections.entries())
        .map(([selection, count]) => ({ selection, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 10),
    };
  }

  /**
   * Get comprehensive analytics dashboard data
   */
  async getDashboardAnalytics(tenantId: string, dateRange?: DateRange) {
    const [
      metrics,
      callVolume,
      peakHours,
      topFAQs,
      leadConversion,
      flowPerformance,
    ] = await Promise.all([
      this.getCallMetrics(tenantId, dateRange),
      dateRange ? this.getCallVolumeOverTime(tenantId, dateRange) : Promise.resolve([]),
      this.getPeakHours(tenantId, dateRange),
      this.getTopFAQs(tenantId, dateRange),
      this.getLeadConversion(tenantId, dateRange),
      this.getFlowPerformance(tenantId, dateRange),
    ]);

    return {
      metrics,
      callVolume,
      peakHours,
      topFAQs,
      leadConversion,
      flowPerformance,
    };
  }
}

export const analyticsService = new AnalyticsService();
