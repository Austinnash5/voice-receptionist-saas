import express from 'express';
import { requireAuth, requireTenantAdmin } from '../middleware/auth';
import { requirePermission, injectPermissions } from '../middleware/permissions';
import {
  getDashboard,
  getCalls,
  getCallDetail,
  getLeads,
  getLeadDetail,
  updateLead,
  exportLeads,
  getSettings,
  updateReceptionistConfig,
  addKnowledgeEntry,
  addTransferTarget,
  getAnalytics,
  updateBusinessHours,
  addHoliday,
  deleteHoliday,
} from '../controllers/tenantController';
import {
  getCRMDashboard,
  getContactsPage,
  getContactDetailPage,
  getContactNewPage,
  getContactEditPage,
  createContactPage,
  updateContactPage,
  getDealsPage,
  getDealPipelinePage,
  getDealDetailPage,
  getDealNewPage,
  createDealPage,
  getCompaniesPage,
  getTasksPage,
} from '../controllers/crmController';
import {
  getTeamPage,
  getRolesPage,
} from '../controllers/userManagementController';

const router = express.Router();

// All tenant routes require authentication
router.use(requireAuth);
router.use(requireTenantAdmin);
router.use(injectPermissions); // Inject user permissions into request

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
router.get('/leads/export/csv', exportLeads);

// Analytics
router.get('/analytics', getAnalytics);

// Settings
router.get('/settings', getSettings);
router.post('/settings/receptionist', updateReceptionistConfig);
router.post('/settings/knowledge', addKnowledgeEntry);
router.post('/settings/transfer-targets', addTransferTarget);
router.post('/settings/business-hours', updateBusinessHours);
router.post('/settings/holidays', addHoliday);
router.post('/settings/holidays/:holidayId/delete', deleteHoliday);

// CRM Routes
router.get('/crm/dashboard', requirePermission('crm', 'view'), getCRMDashboard);
router.get('/crm/contacts', requirePermission('crm', 'view'), getContactsPage);
router.get('/crm/contacts/new', requirePermission('crm', 'create'), getContactNewPage);
router.post('/crm/contacts', requirePermission('crm', 'create'), createContactPage);
router.get('/crm/contacts/:id', requirePermission('crm', 'view'), getContactDetailPage);
router.get('/crm/contacts/:id/edit', requirePermission('crm', 'edit'), getContactEditPage);
router.post('/crm/contacts/:id', requirePermission('crm', 'edit'), updateContactPage);

router.get('/crm/deals', requirePermission('crm', 'view'), getDealsPage);
router.get('/crm/deals/pipeline', requirePermission('crm', 'view'), getDealPipelinePage);
router.get('/crm/deals/new', requirePermission('crm', 'create'), getDealNewPage);
router.post('/crm/deals', requirePermission('crm', 'create'), createDealPage);
router.get('/crm/deals/:id', requirePermission('crm', 'view'), getDealDetailPage);

router.get('/crm/companies', requirePermission('crm', 'view'), getCompaniesPage);
router.get('/crm/tasks', requirePermission('crm', 'view'), getTasksPage);

// User Management Routes
router.get('/settings/team', requirePermission('users', 'view'), getTeamPage);
router.get('/settings/roles', requirePermission('users', 'manage'), getRolesPage);

export default router;
