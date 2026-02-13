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
   * Calculate growth rate between two periods
   */
  private calculateGrowth(current: number, previous: number): number {
    if (previous === 0) return current > 0 ? 100 : 0;
    return Math.round(((current - previous) / previous) * 100);
  }

  /**
   * Get metrics with comparison to previous period
   */
  async getMetricsWithComparison(tenantId: string, dateRange: DateRange) {
    const duration = dateRange.endDate.getTime() - dateRange.startDate.getTime();
    const previousPeriodEnd = new Date(dateRange.startDate.getTime() - 1);
    const previousPeriodStart = new Date(previousPeriodEnd.getTime() - duration);

    const [currentMetrics, previousMetrics] = await Promise.all([
      this.getCallMetrics(tenantId, dateRange),
      this.getCallMetrics(tenantId, {
        startDate: previousPeriodStart,
        endDate: previousPeriodEnd,
      }),
    ]);

    return {
      current: currentMetrics,
      previous: previousMetrics,
      growth: {
        totalCalls: this.calculateGrowth(currentMetrics.totalCalls, previousMetrics.totalCalls),
        completedCalls: this.calculateGrowth(currentMetrics.completedCalls, previousMetrics.completedCalls),
        leadsGenerated: this.calculateGrowth(currentMetrics.leadsGenerated, previousMetrics.leadsGenerated),
        averageDuration: this.calculateGrowth(currentMetrics.averageDuration, previousMetrics.averageDuration),
        successfulTransfers: this.calculateGrowth(currentMetrics.successfulTransfers, previousMetrics.successfulTransfers),
      },
    };
  }

  /**
   * Get call volume by time period (day, week, month)
   */
  async getCallVolumeByPeriod(
    tenantId: string, 
    dateRange: DateRange, 
    groupBy: 'day' | 'week' | 'month' = 'day'
  ) {
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
        leadCaptured: true,
      },
      orderBy: {
        startTime: 'asc',
      },
    });

    const grouped = new Map<string, { calls: number; completed: number; leads: number }>();

    calls.forEach(call => {
      let key: string;
      const date = new Date(call.startTime);

      if (groupBy === 'day') {
        key = date.toISOString().split('T')[0]; // YYYY-MM-DD
      } else if (groupBy === 'week') {
        const weekStart = new Date(date);
        weekStart.setDate(date.getDate() - date.getDay());
        key = weekStart.toISOString().split('T')[0];
      } else {
        key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      }

      if (!grouped.has(key)) {
        grouped.set(key, { calls: 0, completed: 0, leads: 0 });
      }

      const stats = grouped.get(key)!;
      stats.calls++;
      if (call.status === CallStatus.COMPLETED) stats.completed++;
      if (call.leadCaptured) stats.leads++;
    });

    return Array.from(grouped.entries())
      .map(([period, stats]) => ({ period, ...stats }))
      .sort((a, b) => a.period.localeCompare(b.period));
  }

  /**
   * Get week-over-week comparison
   */
  async getWeekOverWeekComparison(tenantId: string, weeks: number = 8) {
    const now = new Date();
    const startDate = new Date(now.getTime() - weeks * 7 * 24 * 60 * 60 * 1000);

    const data = await this.getCallVolumeByPeriod(
      tenantId,
      { startDate, endDate: now },
      'week'
    );

    // Calculate week-over-week growth
    const withGrowth = data.map((week, index) => {
      if (index === 0) {
        return { ...week, growth: 0 };
      }
      const previous = data[index - 1];
      const growth = this.calculateGrowth(week.calls, previous.calls);
      return { ...week, growth };
    });

    return withGrowth;
  }

  /**
   * Get month-over-month comparison
   */
  async getMonthOverMonthComparison(tenantId: string, months: number = 6) {
    const now = new Date();
    const startDate = new Date(now.getFullYear(), now.getMonth() - months, 1);

    const data = await this.getCallVolumeByPeriod(
      tenantId,
      { startDate, endDate: now },
      'month'
    );

    // Calculate month-over-month growth
    const withGrowth = data.map((month, index) => {
      if (index === 0) {
        return { ...month, growth: 0 };
      }
      const previous = data[index - 1];
      const growth = this.calculateGrowth(month.calls, previous.calls);
      return { ...month, growth };
    });

    return withGrowth;
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

  /**
   * Get comprehensive analytics with comparisons
   */
  async getDashboardAnalyticsWithComparison(tenantId: string, dateRange: DateRange) {
    const [
      dashboardData,
      metricsComparison,
    ] = await Promise.all([
      this.getDashboardAnalytics(tenantId, dateRange),
      this.getMetricsWithComparison(tenantId, dateRange),
    ]);

    return {
      ...dashboardData,
      comparison: metricsComparison,
    };
  }
}

export const analyticsService = new AnalyticsService();
