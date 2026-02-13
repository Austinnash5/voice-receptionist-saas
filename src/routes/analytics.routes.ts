import { Router } from 'express';
import * as analyticsController from '../controllers/analyticsController';

const router = Router();

/**
 * Analytics API Routes
 * Base path: /api/tenants/:tenantId/analytics
 */

// Get comprehensive analytics dashboard data
router.get('/', analyticsController.getAnalytics);

// Get specific analytics data
router.get('/metrics', analyticsController.getCallMetrics);
router.get('/call-volume', analyticsController.getCallVolume);
router.get('/peak-hours', analyticsController.getPeakHours);
router.get('/top-faqs', analyticsController.getTopFAQs);
router.get('/lead-conversion', analyticsController.getLeadConversion);
router.get('/flow-performance', analyticsController.getFlowPerformance);

// Comparison endpoints
router.get('/comparison/metrics', analyticsController.getMetricsComparison);
router.get('/comparison/week-over-week', analyticsController.getWeekOverWeek);
router.get('/comparison/month-over-month', analyticsController.getMonthOverMonth);

export default router;
