import { Request, Response, NextFunction } from 'express';
import { permissionService, PermissionCheck } from '../services/rbac/permissionService';

// Extend Express Request type to include user
declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        email: string;
        role: string;
        tenantId?: string;
      };
      tenant?: {
        id: string;
        slug: string;
      };
    }
  }
}

/**
 * Middleware to check if user has required permission
 */
export const requirePermission = (resource: string, action: string) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    const user = req.user;

    if (!user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    try {
      const hasPermission = await permissionService.hasPermission(
        user.id,
        resource,
        action
      );

      if (!hasPermission) {
        return res.status(403).json({
          error: 'Forbidden',
          message: `You don't have permission to ${action} ${resource}`,
        });
      }

      next();
    } catch (error) {
      console.error('Permission check error:', error);
      return res.status(500).json({ error: 'Internal server error' });
    }
  };
};

/**
 * Middleware to check if user has any of the required permissions
 */
export const requireAnyPermission = (permissions: PermissionCheck[]) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    const user = req.user;

    if (!user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    try {
      const hasAny = await permissionService.hasAnyPermission(
        user.id,
        permissions
      );

      if (!hasAny) {
        return res.status(403).json({
          error: 'Forbidden',
          message: `You don't have the required permissions`,
        });
      }

      next();
    } catch (error) {
      console.error('Permission check error:', error);
      return res.status(500).json({ error: 'Internal server error' });
    }
  };
};

/**
 * Middleware to check if user has all of the required permissions
 */
export const requireAllPermissions = (permissions: PermissionCheck[]) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    const user = req.user;

    if (!user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    try {
      const hasAll = await permissionService.hasAllPermissions(
        user.id,
        permissions
      );

      if (!hasAll) {
        return res.status(403).json({
          error: 'Forbidden',
          message: `You don't have all the required permissions`,
        });
      }

      next();
    } catch (error) {
      console.error('Permission check error:', error);
      return res.status(500).json({ error: 'Internal server error' });
    }
  };
};

/**
 * Middleware to check if user is admin (SUPER_ADMIN or TENANT_ADMIN)
 */
export const requireAdmin = (req: Request, res: Response, next: NextFunction) => {
  const user = req.user;

  if (!user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  if (user.role !== 'SUPER_ADMIN' && user.role !== 'TENANT_ADMIN') {
    return res.status(403).json({
      error: 'Forbidden',
      message: 'Admin access required',
    });
  }

  next();
};

/**
 * Middleware to check if user is tenant admin
 */
export const requireTenantAdmin = (req: Request, res: Response, next: NextFunction) => {
  const user = req.user;

  if (!user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  if (user.role !== 'TENANT_ADMIN') {
    return res.status(403).json({
      error: 'Forbidden',
      message: 'Tenant admin access required',
    });
  }

  next();
};

/**
 * Middleware to inject user permissions into request
 */
export const injectPermissions = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const user = req.user;

  if (user) {
    try {
      const permissions = await permissionService.getUserPermissions(user.id);
      (req as any).permissions = permissions;
    } catch (error) {
      console.error('Error injecting permissions:', error);
    }
  }

  next();
};
