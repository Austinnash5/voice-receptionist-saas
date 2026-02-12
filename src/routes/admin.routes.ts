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

export default router;
