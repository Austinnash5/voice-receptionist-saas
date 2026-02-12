import { Request, Response, NextFunction } from 'express';
import prisma from '../db/prisma';

/**
 * Ensure user has access to tenant resources
 */
export async function requireTenantAccess(req: Request, res: Response, next: NextFunction) {
  if (!req.user) {
    return res.status(401).send('Unauthorized');
  }

  // Super admin can access all tenants
  if (req.user.role === 'SUPER_ADMIN') {
    return next();
  }

  // Check tenant ID in params or body
  const tenantId = req.params.tenantId || req.body.tenantId;

  if (!tenantId) {
    // If no tenant specified, allow if user has a tenant
    if (req.user.tenantId) {
      return next();
    }
    return res.status(400).send('Tenant ID required');
  }

  if (req.user.tenantId !== tenantId) {
    return res.status(403).send('Forbidden: Access denied to this tenant');
  }

  next();
}

/**
 * Load tenant by slug in params
 */
export async function loadTenantBySlug(req: Request, res: Response, next: NextFunction) {
  const { slug } = req.params;

  if (!slug) {
    return res.status(400).send('Tenant slug required');
  }

  try {
    const tenant = await prisma.tenant.findUnique({
      where: { slug },
    });

    if (!tenant) {
      return res.status(404).send('Tenant not found');
    }

    req.tenant = {
      id: tenant.id,
      name: tenant.name,
      slug: tenant.slug,
    };

    next();
  } catch (error) {
    console.error('Load tenant error:', error);
    return res.status(500).send('Internal server error');
  }
}
