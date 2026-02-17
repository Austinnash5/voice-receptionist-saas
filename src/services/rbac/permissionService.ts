import { prisma } from '../../db/prisma';

export interface PermissionCheck {
  resource: string;
  action: string;
}

export class PermissionService {
  /**
   * Check if a user has a specific permission
   */
  async hasPermission(
    userId: string,
    resource: string,
    action: string
  ): Promise<boolean> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        customRole: {
          include: {
            permissions: {
              include: {
                permission: true,
              },
            },
          },
        },
      },
    });

    if (!user) return false;

    // SUPER_ADMIN has all permissions
    if (user.role === 'SUPER_ADMIN') return true;

    // TENANT_ADMIN has all permissions within their tenant
    if (user.role === 'TENANT_ADMIN') return true;

    // Check custom role permissions
    if (user.customRole) {
      const hasPermission = user.customRole.permissions.some(
        (rp) =>
          rp.permission.resource === resource && rp.permission.action === action
      );
      return hasPermission;
    }

    // Default TENANT_USER has limited permissions
    // View-only access to most resources
    if (user.role === 'TENANT_USER') {
      const allowedPermissions = [
        'voice:view',
        'crm:view',
        'sms:view',
        'email:view',
        'chatbot:view',
      ];
      return allowedPermissions.includes(`${resource}:${action}`);
    }

    return false;
  }

  /**
   * Check multiple permissions at once
   */
  async hasAnyPermission(
    userId: string,
    permissions: PermissionCheck[]
  ): Promise<boolean> {
    for (const perm of permissions) {
      const has = await this.hasPermission(userId, perm.resource, perm.action);
      if (has) return true;
    }
    return false;
  }

  /**
   * Check if user has all permissions
   */
  async hasAllPermissions(
    userId: string,
    permissions: PermissionCheck[]
  ): Promise<boolean> {
    for (const perm of permissions) {
      const has = await this.hasPermission(userId, perm.resource, perm.action);
      if (!has) return false;
    }
    return true;
  }

  /**
   * Get all permissions for a user
   */
  async getUserPermissions(userId: string): Promise<string[]> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        customRole: {
          include: {
            permissions: {
              include: {
                permission: true,
              },
            },
          },
        },
      },
    });

    if (!user) return [];

    // SUPER_ADMIN and TENANT_ADMIN have all permissions
    if (user.role === 'SUPER_ADMIN' || user.role === 'TENANT_ADMIN') {
      const allPermissions = await prisma.permission.findMany();
      return allPermissions.map((p) => `${p.resource}:${p.action}`);
    }

    // Get custom role permissions
    if (user.customRole) {
      return user.customRole.permissions.map(
        (rp) => `${rp.permission.resource}:${rp.permission.action}`
      );
    }

    // Default TENANT_USER permissions
    return ['voice:view', 'crm:view', 'sms:view', 'email:view', 'chatbot:view'];
  }

  /**
   * Create a new role with permissions
   */
  async createRole(
    tenantId: string,
    name: string,
    description: string,
    permissionIds: string[]
  ) {
    const role = await prisma.role.create({
      data: {
        tenantId,
        name,
        description,
        permissions: {
          create: permissionIds.map((permissionId) => ({
            permissionId,
          })),
        },
      },
      include: {
        permissions: {
          include: {
            permission: true,
          },
        },
      },
    });

    return role;
  }

  /**
   * Update role permissions
   */
  async updateRolePermissions(roleId: string, permissionIds: string[]) {
    // Delete existing permissions
    await prisma.rolePermission.deleteMany({
      where: { roleId },
    });

    // Create new permissions
    await prisma.rolePermission.createMany({
      data: permissionIds.map((permissionId) => ({
        roleId,
        permissionId,
      })),
    });

    return this.getRoleById(roleId);
  }

  /**
   * Get role by ID
   */
  async getRoleById(roleId: string) {
    return prisma.role.findUnique({
      where: { id: roleId },
      include: {
        permissions: {
          include: {
            permission: true,
          },
        },
      },
    });
  }

  /**
   * Get all roles for a tenant
   */
  async getTenantRoles(tenantId: string) {
    return prisma.role.findMany({
      where: { tenantId },
      include: {
        permissions: {
          include: {
            permission: true,
          },
        },
        _count: {
          select: { users: true },
        },
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  /**
   * Get all available permissions
   */
  async getAllPermissions() {
    return prisma.permission.findMany({
      orderBy: [{ resource: 'asc' }, { action: 'asc' }],
    });
  }

  /**
   * Delete a role (only if not system role)
   */
  async deleteRole(roleId: string) {
    const role = await prisma.role.findUnique({
      where: { id: roleId },
    });

    if (!role) throw new Error('Role not found');
    if (role.isSystem) throw new Error('Cannot delete system role');

    // Unassign users from this role
    await prisma.user.updateMany({
      where: { roleId },
      data: { roleId: null },
    });

    // Delete role
    await prisma.role.delete({
      where: { id: roleId },
    });
  }

  /**
   * Assign role to user
   */
  async assignRoleToUser(userId: string, roleId: string | null) {
    return prisma.user.update({
      where: { id: userId },
      data: { roleId },
    });
  }

  /**
   * Initialize default roles for a tenant
   */
  async initializeDefaultRoles(tenantId: string) {
    // Get all permissions
    const allPermissions = await this.getAllPermissions();

    // Create default roles
    const roles = [
      {
        name: 'Full Access',
        description: 'Full access to all features',
        isSystem: true,
        permissions: allPermissions.map((p) => p.id),
      },
      {
        name: 'Sales Manager',
        description: 'Full CRM access, view-only for other features',
        isSystem: true,
        permissions: allPermissions
          .filter(
            (p) =>
              p.resource === 'crm' ||
              (p.resource !== 'settings' && p.action === 'view')
          )
          .map((p) => p.id),
      },
      {
        name: 'Support Agent',
        description: 'View calls and CRM, create notes and tasks',
        isSystem: true,
        permissions: allPermissions
          .filter(
            (p) =>
              p.action === 'view' ||
              (p.resource === 'crm' && ['create', 'edit'].includes(p.action))
          )
          .map((p) => p.id),
      },
      {
        name: 'Read Only',
        description: 'View-only access to all features',
        isSystem: true,
        permissions: allPermissions
          .filter((p) => p.action === 'view')
          .map((p) => p.id),
      },
    ];

    for (const roleData of roles) {
      await prisma.role.create({
        data: {
          tenantId,
          name: roleData.name,
          description: roleData.description,
          isSystem: roleData.isSystem,
          permissions: {
            create: roleData.permissions.map((permissionId) => ({
              permissionId,
            })),
          },
        },
      });
    }
  }
}

export const permissionService = new PermissionService();
