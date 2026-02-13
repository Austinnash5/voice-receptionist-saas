import { Request, Response } from 'express';
import { analyticsService } from '../services/analytics/analyticsService';

/**
 * Parse date range from query parameters
 */
function parseDateRange(req: Request) {
  const { startDate, endDate, period } = req.query;

  // If period is specified (e.g., 7d, 30d, 90d), calculate dates
  if (period) {
    const now = new Date();
    const days = parseInt(period as string);
    
    if (!isNaN(days)) {
      return {
        startDate: new Date(now.getTime() - days * 24 * 60 * 60 * 1000),
        endDate: now,
      };
    }
  }

  // If explicit dates provided
  if (startDate && endDate) {
    return {
      startDate: new Date(startDate as string),
      endDate: new Date(endDate as string),
    };
  }

  // Default: last 30 days
  const now = new Date();
  return {
    startDate: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000),
    endDate: now,
  };
}

/**
 * Get analytics dashboard data
 */
export async function getAnalytics(req: Request, res: Response) {
  try {
    const { tenantId } = req.params;
    console.log('Analytics request - tenantId:', tenantId);
    
    const dateRange = parseDateRange(req);
    console.log('Date range:', dateRange);
    
    const includeComparison = req.query.comparison === 'true';
    console.log('Include comparison:', includeComparison);

    let analytics;
    if (includeComparison) {
      console.log('Fetching analytics with comparison...');
      analytics = await analyticsService.getDashboardAnalyticsWithComparison(tenantId, dateRange);
    } else {
      console.log('Fetching analytics without comparison...');
      analytics = await analyticsService.getDashboardAnalytics(tenantId, dateRange);
    }

    console.log('Analytics fetched successfully');
    res.json({
      success: true,
      data: analytics,
      dateRange: {
        startDate: dateRange.startDate.toISOString(),
        endDate: dateRange.endDate.toISOString(),
      },
    });
  } catch (error) {
    console.error('Get analytics error:', error);
    console.error('Error stack:', error instanceof Error ? error.stack : 'No stack trace');
    res.status(500).json({ 
      success: false, 
      error: 'Failed to fetch analytics',
      details: error instanceof Error ? error.message : String(error)
    });
  }
}

/**
 * Get call metrics only
 */
export async function getCallMetrics(req: Request, res: Response) {
  try {
    const { tenantId } = req.params;
    const dateRange = parseDateRange(req);

    const metrics = await analyticsService.getCallMetrics(tenantId, dateRange);

    res.json({
      success: true,
      data: metrics,
    });
  } catch (error) {
    console.error('Get call metrics error:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to fetch call metrics' 
    });
  }
}

/**
 * Get call volume over time
 */
export async function getCallVolume(req: Request, res: Response) {
  try {
    const { tenantId } = req.params;
    const dateRange = parseDateRange(req);

    const callVolume = await analyticsService.getCallVolumeOverTime(tenantId, dateRange);

    res.json({
      success: true,
      data: callVolume,
    });
  } catch (error) {
    console.error('Get call volume error:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to fetch call volume' 
    });
  }
}

/**
 * Get peak hours analysis
 */
export async function getPeakHours(req: Request, res: Response) {
  try {
    const { tenantId } = req.params;
    const dateRange = parseDateRange(req);

    const peakHours = await analyticsService.getPeakHours(tenantId, dateRange);

    res.json({
      success: true,
      data: peakHours,
    });
  } catch (error) {
    console.error('Get peak hours error:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to fetch peak hours' 
    });
  }
}

/**
 * Get top FAQs
 */
export async function getTopFAQs(req: Request, res: Response) {
  try {
    const { tenantId } = req.params;
    const dateRange = parseDateRange(req);
    const limit = req.query.limit ? parseInt(req.query.limit as string) : 10;

    const topFAQs = await analyticsService.getTopFAQs(tenantId, dateRange, limit);

    res.json({
      success: true,
      data: topFAQs,
    });
  } catch (error) {
    console.error('Get top FAQs error:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to fetch top FAQs' 
    });
  }
}

/**
 * Get lead conversion data
 */
export async function getLeadConversion(req: Request, res: Response) {
  try {
    const { tenantId } = req.params;
    const dateRange = parseDateRange(req);

    const leadConversion = await analyticsService.getLeadConversion(tenantId, dateRange);

    res.json({
      success: true,
      data: leadConversion,
    });
  } catch (error) {
    console.error('Get lead conversion error:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to fetch lead conversion' 
    });
  }
}

/**
 * Get flow performance metrics
 */
export async function getFlowPerformance(req: Request, res: Response) {
  try {
    const { tenantId } = req.params;
    const dateRange = parseDateRange(req);

    const flowPerformance = await analyticsService.getFlowPerformance(tenantId, dateRange);

    res.json({
      success: true,
      data: flowPerformance,
    });
  } catch (error) {
    console.error('Get flow performance error:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to fetch flow performance' 
    });
  }
}

/**
 * Get week-over-week comparison
 */
export async function getWeekOverWeek(req: Request, res: Response) {
  try {
    const { tenantId } = req.params;
    const weeks = req.query.weeks ? parseInt(req.query.weeks as string) : 8;

    const data = await analyticsService.getWeekOverWeekComparison(tenantId, weeks);

    res.json({
      success: true,
      data,
    });
  } catch (error) {
    console.error('Get week-over-week error:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to fetch week-over-week comparison' 
    });
  }
}

/**
 * Get month-over-month comparison
 */
export async function getMonthOverMonth(req: Request, res: Response) {
  try {
    const { tenantId } = req.params;
    const months = req.query.months ? parseInt(req.query.months as string) : 6;

    const data = await analyticsService.getMonthOverMonthComparison(tenantId, months);

    res.json({
      success: true,
      data,
    });
  } catch (error) {
    console.error('Get month-over-month error:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to fetch month-over-month comparison' 
    });
  }
}

/**
 * Get metrics with comparison
 */
export async function getMetricsComparison(req: Request, res: Response) {
  try {
    const { tenantId } = req.params;
    const dateRange = parseDateRange(req);

    const data = await analyticsService.getMetricsWithComparison(tenantId, dateRange);

    res.json({
      success: true,
      data,
    });
  } catch (error) {
    console.error('Get metrics comparison error:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to fetch metrics comparison' 
    });
  }
}
