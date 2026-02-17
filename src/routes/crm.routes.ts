import { Router } from 'express';
import { crmController } from '../controllers/crmController';
import { requireAuth } from '../middleware/auth';
import { requireTenantAccess } from '../middleware/tenant';
import { requirePermission } from '../middleware/permissions';

const router = Router();

// Apply auth and tenant middleware to all routes
router.use(requireAuth);
router.use(requireTenantAccess);

// ============================================
// CONTACTS
// ============================================

router.get(
  '/contacts',
  requirePermission('crm', 'view'),
  crmController.getContacts.bind(crmController)
);

router.get(
  '/contacts/search',
  requirePermission('crm', 'view'),
  crmController.searchContacts.bind(crmController)
);

router.get(
  '/contacts/stats',
  requirePermission('crm', 'view'),
  crmController.getContactStats.bind(crmController)
);

router.get(
  '/contacts/:id',
  requirePermission('crm', 'view'),
  crmController.getContact.bind(crmController)
);

router.post(
  '/contacts',
  requirePermission('crm', 'create'),
  crmController.createContact.bind(crmController)
);

router.put(
  '/contacts/:id',
  requirePermission('crm', 'edit'),
  crmController.updateContact.bind(crmController)
);

router.delete(
  '/contacts/:id',
  requirePermission('crm', 'delete'),
  crmController.deleteContact.bind(crmController)
);

router.post(
  '/contacts/:id/notes',
  requirePermission('crm', 'edit'),
  crmController.addContactNote.bind(crmController)
);

router.post(
  '/leads/:leadId/convert',
  requirePermission('crm', 'create'),
  crmController.convertLeadToContact.bind(crmController)
);

// ============================================
// COMPANIES
// ============================================

router.get(
  '/companies',
  requirePermission('crm', 'view'),
  crmController.getCompanies.bind(crmController)
);

router.post(
  '/companies',
  requirePermission('crm', 'create'),
  crmController.createCompany.bind(crmController)
);

// ============================================
// DEALS
// ============================================

router.get(
  '/deals',
  requirePermission('crm', 'view'),
  crmController.getDeals.bind(crmController)
);

router.get(
  '/deals/stats',
  requirePermission('crm', 'view'),
  crmController.getDealStats.bind(crmController)
);

router.get(
  '/deals/:id',
  requirePermission('crm', 'view'),
  crmController.getDeal.bind(crmController)
);

router.post(
  '/deals',
  requirePermission('crm', 'create'),
  crmController.createDeal.bind(crmController)
);

router.put(
  '/deals/:id',
  requirePermission('crm', 'edit'),
  crmController.updateDeal.bind(crmController)
);

router.post(
  '/deals/:id/win',
  requirePermission('crm', 'edit'),
  crmController.winDeal.bind(crmController)
);

router.post(
  '/deals/:id/lose',
  requirePermission('crm', 'edit'),
  crmController.loseDeal.bind(crmController)
);

// ============================================
// PIPELINES
// ============================================

router.get(
  '/pipelines',
  requirePermission('crm', 'view'),
  crmController.getPipelines.bind(crmController)
);

router.get(
  '/pipelines/:pipelineId/view',
  requirePermission('crm', 'view'),
  crmController.getPipelineView.bind(crmController)
);

// ============================================
// TASKS
// ============================================

router.get(
  '/tasks',
  requirePermission('crm', 'view'),
  crmController.getTasks.bind(crmController)
);

router.post(
  '/tasks',
  requirePermission('crm', 'create'),
  crmController.createTask.bind(crmController)
);

router.put(
  '/tasks/:id',
  requirePermission('crm', 'edit'),
  crmController.updateTask.bind(crmController)
);

// ============================================
// TAGS
// ============================================

router.get(
  '/tags',
  requirePermission('crm', 'view'),
  crmController.getTags.bind(crmController)
);

router.post(
  '/tags',
  requirePermission('crm', 'create'),
  crmController.createTag.bind(crmController)
);

export default router;
