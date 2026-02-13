import express from 'express';
import { requireAuth, requireTenantAdmin } from '../middleware/auth';
import {
  getDashboard,
  getCalls,
  getCallDetail,
  getLeads,
  getLeadDetail,
  updateLead,
  getSettings,
  updateReceptionistConfig,
  addKnowledgeEntry,
  addTransferTarget,
  getAnalytics,
} from '../controllers/tenantController';

const router = express.Router();

// All tenant routes require authentication
router.use(requireAuth);
router.use(requireTenantAdmin);

// Dashboard
router.get('/dashboard', getDashboard);
router.get('/', (req, res) => res.redirect('/tenant/dashboard'));

// Calls
router.get('/calls', getCalls);
router.get('/calls/:id', getCallDetail);

// Leads
router.get('/leads', getLeads);
router.get('/leads/:id', getLeadDetail);
router.post('/leads/:id', updateLead);

// Analytics
router.get('/analytics', getAnalytics);

// Settings
router.get('/settings', getSettings);
router.post('/settings/receptionist', updateReceptionistConfig);
router.post('/settings/knowledge', addKnowledgeEntry);
router.post('/settings/transfer-targets', addTransferTarget);

export default router;
