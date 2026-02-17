import { Router } from 'express';
import { userManagementController } from '../controllers/userManagementController';
import { requireAuth } from '../middleware/auth';
import { requireTenantContext } from '../middleware/tenant';
import { requirePermission,requireTenantAdmin } from '../middleware/permissions';

const router = Router();

// Apply auth and tenant middleware to all routes
router.use(requireAuth);
router.use(requireTenantContext);

// ============================================
// USERS
// ============================================

router.get(
  '/users',
  requirePermission('users', 'view'),
  userManagementController.getUsers.bind(userManagementController)
);

router.post(
  '/users/invite',
  requirePermission('users', 'manage'),
  userManagementController.inviteUser.bind(userManagementController)
);

router.put(
  '/users/:id',
  requirePermission('users', 'manage'),
  userManagementController.updateUser.bind(userManagementController)
);

router.post(
  '/users/:id/deactivate',
  requirePermission('users', 'manage'),
  userManagementController.deactivateUser.bind(userManagementController)
);

router.post(
  '/users/:id/reactivate',
  requirePermission('users', 'manage'),
  userManagementController.reactivateUser.bind(userManagementController)
);

router.post(
  '/users/:id/assign-role',
  requirePermission('users', 'manage'),
  userManagementController.assignRole.bind(userManagementController)
);

// ============================================
// ROLES & PERMISSIONS
// ============================================

router.get(
  '/roles',
  requirePermission('users', 'view'),
  userManagementController.getRoles.bind(userManagementController)
);

router.post(
  '/roles',
  requireTenantAdmin,
  userManagementController.createRole.bind(userManagementController)
);

router.put(
  '/roles/:id',
  requireTenantAdmin,
  userManagementController.updateRole.bind(userManagementController)
);

router.delete(
  '/roles/:id',
  requireTenantAdmin,
  userManagementController.deleteRole.bind(userManagementController)
);

router.get(
  '/permissions',
  requirePermission('users', 'view'),
  userManagementController.getPermissions.bind(userManagementController)
);

router.get(
  '/permissions/me',
  userManagementController.getMyPermissions.bind(userManagementController)
);

export default router;
