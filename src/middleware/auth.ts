import { Request, Response, NextFunction } from 'express';
import bcrypt from 'bcryptjs';
import prisma from '../db/prisma';

/**
 * Check if user is authenticated
 */
export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (!req.session || !req.session.userId) {
    return res.redirect('/login');
  }

  try {
    const user = await prisma.user.findUnique({
      where: { id: req.session.userId },
      include: { tenant: true },
    });

    if (!user) {
      req.session.destroy(() => {});
      return res.redirect('/login');
    }

    req.user = {
      id: user.id,
      email: user.email,
      role: user.role,
      tenantId: user.tenantId,
    };

    if (user.tenant) {
      req.tenant = {
        id: user.tenant.id,
        name: user.tenant.name,
        slug: user.tenant.slug,
      };
    }

    // Load user permissions if they have a roleId
    if (user.roleId) {
      const rolePermissions = await prisma.rolePermission.findMany({
        where: { roleId: user.roleId },
        include: { permission: true },
      });
      
      req.userPermissions = rolePermissions.map(rp => 
        `${rp.permission.resource}:${rp.permission.action}`
      );
    } else {
      req.userPermissions = [];
    }

    next();
  } catch (error) {
    console.error('Auth middleware error:', error);
    return res.status(500).send('Internal server error');
  }
}

/**
 * Check if user is super admin
 */
export function requireSuperAdmin(req: Request, res: Response, next: NextFunction) {
  if (!req.user || req.user.role !== 'SUPER_ADMIN') {
    return res.status(403).send('Forbidden: Super Admin access required');
  }
  next();
}

/**
 * Check if user is tenant admin
 */
export function requireTenantAdmin(req: Request, res: Response, next: NextFunction) {
  if (!req.user || !['TENANT_ADMIN', 'SUPER_ADMIN'].includes(req.user.role)) {
    return res.status(403).send('Forbidden: Admin access required');
  }
  next();
}

/**
 * Login user
 */
export async function loginUser(
  email: string,
  password: string
): Promise<{ success: boolean; user?: any; error?: string }> {
  try {
    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
      include: { tenant: true },
    });

    if (!user) {
      return { success: false, error: 'Invalid credentials' };
    }

    const passwordMatch = await bcrypt.compare(password, user.password);

    if (!passwordMatch) {
      return { success: false, error: 'Invalid credentials' };
    }

    return { 
      success: true, 
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        tenantId: user.tenantId,
        tenant: user.tenant,
      } 
    };
  } catch (error) {
    console.error('Login error:', error);
    return { success: false, error: 'Login failed' };
  }
}

/**
 * Hash password
 */
export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}

// Extend Express Session type
declare module 'express-session' {
  interface SessionData {
    userId: string;
  }
}
