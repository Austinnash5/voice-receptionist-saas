import { Request, Response } from 'express';
import { prisma } from '../db/prisma';
import bcrypt from 'bcryptjs';
import { permissionService } from '../services/rbac/permissionService';

export class UserManagementController {
  /**
   * Get all users for tenant
   */
  async getUsers(req: Request, res: Response) {
    try {
      const tenantId = req.tenant!.id;

      const users = await prisma.user.findMany({
        where: { tenantId },
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
        orderBy: { createdAt: 'asc' },
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          role: true,
          isActive: true,
          lastLoginAt: true,
          createdAt: true,
          customRole: true,
        },
      });

      res.json(users);
    } catch (error) {
      console.error('Error fetching users:', error);
      res.status(500).json({ error: 'Failed to fetch users' });
    }
  }

  /**
   * Invite a new user (sub-user)
   */
  async inviteUser(req: Request, res: Response) {
    try {
      const tenantId = req.tenant!.id;
      const invitedBy = req.user!.id;
      const { email, firstName, lastName, roleId } = req.body;

      // Check if user already exists
      const existingUser = await prisma.user.findUnique({
        where: { email },
      });

      if (existingUser) {
        return res.status(400).json({ error: 'User with this email already exists' });
      }

      // Generate temporary password
      const tempPassword = Math.random().toString(36).slice(-8);
      const hashedPassword = await bcrypt.hash(tempPassword, 10);

      // Create user
      const user = await prisma.user.create({
        data: {
          email,
          password: hashedPassword,
          firstName,
          lastName,
          role: 'TENANT_USER', // Default role
          roleId,
          tenantId,
          invitedBy,
          isActive: true,
        },
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

      // TODO: Send invitation email with temp password

      res.status(201).json({
        user: {
          id: user.id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          role: user.role,
          customRole: user.customRole,
        },
        tempPassword, // In production, don't return this - send via email
      });
    } catch (error) {
      console.error('Error inviting user:', error);
      res.status(500).json({ error: 'Failed to invite user' });
    }
  }

  /**
   * Update user details
   */
  async updateUser(req: Request, res: Response) {
    try {
      const userId = req.params.id;
      const { firstName, lastName, roleId, isActive } = req.body;

      const user = await prisma.user.update({
        where: { id: userId },
        data: {
          firstName,
          lastName,
          roleId,
          isActive,
        },
        include: {
          customRole: true,
        },
      });

      res.json(user);
    } catch (error) {
      console.error('Error updating user:', error);
      res.status(500).json({ error: 'Failed to update user' });
    }
  }

  /**
   * Deactivate user
   */
  async deactivateUser(req: Request, res: Response) {
    try {
      const userId = req.params.id;

      await prisma.user.update({
        where: { id: userId },
        data: { isActive: false },
      });

      res.json({ message: 'User deactivated successfully' });
    } catch (error) {
      console.error('Error deactivating user:', error);
      res.status(500).json({ error: 'Failed to deactivate user' });
    }
  }

  /**
   * Reactivate user
   */
  async reactivateUser(req: Request, res: Response) {
    try {
      const userId = req.params.id;

      await prisma.user.update({
        where: { id: userId },
        data: { isActive: true },
      });

      res.json({ message: 'User reactivated successfully' });
    } catch (error) {
      console.error('Error reactivating user:', error);
      res.status(500).json({ error: 'Failed to reactivate user' });
    }
  }

  /**
   * Get all roles for tenant
   */
  async getRoles(req: Request, res: Response) {
    try {
      const tenantId = req.tenant!.id;

      const roles = await permissionService.getTenantRoles(tenantId);

      res.json(roles);
    } catch (error) {
      console.error('Error fetching roles:', error);
      res.status(500).json({ error: 'Failed to fetch roles' });
    }
  }

  /**
   * Create custom role
   */
  async createRole(req: Request, res: Response) {
    try {
      const tenantId = req.tenant!.id;
      const { name, description, permissionIds } = req.body;

      const role = await permissionService.createRole(
        tenantId,
        name,
        description,
        permissionIds
      );

      res.status(201).json(role);
    } catch (error) {
      console.error('Error creating role:', error);
      res.status(500).json({ error: 'Failed to create role' });
    }
  }

  /**
   * Update role permissions
   */
  async updateRole(req: Request, res: Response) {
    try {
      const roleId = req.params.id;
      const { name, description, permissionIds } = req.body;

      // Update basic info
      await prisma.role.update({
        where: { id: roleId },
        data: { name, description },
      });

      // Update permissions
      const role = await permissionService.updateRolePermissions(roleId, permissionIds);

      res.json(role);
    } catch (error) {
      console.error('Error updating role:', error);
      res.status(500).json({ error: 'Failed to update role' });
    }
  }

  /**
   * Delete role
   */
  async deleteRole(req: Request, res: Response) {
    try {
      const roleId = req.params.id;

      await permissionService.deleteRole(roleId);

      res.json({ message: 'Role deleted successfully' });
    } catch (error: any) {
      console.error('Error deleting role:', error);
      res.status(500).json({ error: error.message || 'Failed to delete role' });
    }
  }

  /**
   * Get all available permissions
   */
  async getPermissions(req: Request, res: Response) {
    try {
      const permissions = await permissionService.getAllPermissions();

      // Group by resource
      const grouped = permissions.reduce((acc: any, perm) => {
        if (!acc[perm.resource]) {
          acc[perm.resource] = [];
        }
        acc[perm.resource].push(perm);
        return acc;
      }, {});

      res.json(grouped);
    } catch (error) {
      console.error('Error fetching permissions:', error);
      res.status(500).json({ error: 'Failed to fetch permissions' });
    }
  }

  /**
   * Get current user's permissions
   */
  async getMyPermissions(req: Request, res: Response) {
    try {
      const userId = req.user!.id;

      const permissions = await permissionService.getUserPermissions(userId);

      res.json({ permissions });
    } catch (error) {
      console.error('Error fetching user permissions:', error);
      res.status(500).json({ error: 'Failed to fetch user permissions' });
    }
  }

  /**
   * Assign role to user
   */
  async assignRole(req: Request, res: Response) {
    try {
      const userId = req.params.id;
      const { roleId } = req.body;

      await permissionService.assignRoleToUser(userId, roleId);

      res.json({ message: 'Role assigned successfully' });
    } catch (error) {
      console.error('Error assigning role:', error);
      res.status(500).json({ error: 'Failed to assign role' });
    }
  }
}

export const userManagementController = new UserManagementController();
