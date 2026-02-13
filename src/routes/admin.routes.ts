import express from 'express';
import { requireAuth, requireSuperAdmin } from '../middleware/auth';
import {
  getDashboard,
  getTenants,
  getCreateTenantForm,
  createTenant,
  getTenant,
  updateTenant,
  deleteTenant,
  getNumbers,
  assignNumber,
  unassignNumber,
  getFAQsPage,
  getKnowledgePage,
  getFlowsPage,
  getCreateFlowPage,
  getEditFlowPage,
  getTestKnowledgePage,
} from '../controllers/adminController';

const router = express.Router();

// All admin routes require authentication and super admin role
router.use(requireAuth);
router.use(requireSuperAdmin);

// Dashboard
router.get('/dashboard', getDashboard);
router.get('/', (req, res) => res.redirect('/admin/dashboard'));

// Tenants
router.get('/tenants', getTenants);
router.get('/tenants/new', getCreateTenantForm);
router.post('/tenants', createTenant);
router.get('/tenants/:id', getTenant);
router.post('/tenants/:id', updateTenant);
router.post('/tenants/:id/delete', deleteTenant);

// Phone Numbers
router.get('/numbers', getNumbers);
router.post('/numbers', assignNumber);
router.post('/numbers/:id/delete', unassignNumber);

// Knowledge Management - FAQ, Knowledge Base, Call Flows
router.get('/tenants/:tenantId/faqs', getFAQsPage);
router.get('/tenants/:tenantId/knowledge', getKnowledgePage);
router.get('/tenants/:tenantId/flows', getFlowsPage);
router.get('/tenants/:tenantId/flows/new', getCreateFlowPage);
router.get('/tenants/:tenantId/flows/:flowId/edit', getEditFlowPage);
router.get('/tenants/:tenantId/test', getTestKnowledgePage);

export default router;
