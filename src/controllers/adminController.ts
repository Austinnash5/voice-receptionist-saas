import { Request, Response } from 'express';
import prisma from '../db/prisma';
import { hashPassword } from '../middleware/auth';

/**
 * Admin Dashboard
 */
export async function getDashboard(req: Request, res: Response) {
  try {
    const stats = {
      totalTenants: await prisma.tenant.count(),
      activeTenants: await prisma.tenant.count({ where: { status: 'ACTIVE' } }),
      totalCalls: await prisma.callSession.count(),
      totalLeads: await prisma.lead.count(),
    };

    res.render('admin/dashboard', {
      user: req.user,
      stats,
    });
  } catch (error) {
    console.error('Dashboard error:', error);
    res.status(500).send('Error loading dashboard');
  }
}

/**
 * List tenants
 */
export async function getTenants(req: Request, res: Response) {
  try {
    const tenants = await prisma.tenant.findMany({
      include: {
        twilioNumbers: true,
        _count: {
          select: {
            callSessions: true,
            leads: true,
            users: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    res.render('admin/tenants', {
      user: req.user,
      tenants,
      success: req.query.success || null,
    });
  } catch (error) {
    console.error('Get tenants error:', error);
    res.status(500).send('Error loading tenants');
  }
}

/**
 * Create tenant form
 */
export function getCreateTenantForm(req: Request, res: Response) {
  res.render('admin/create-tenant', {
    user: req.user,
    error: null,
  });
}

/**
 * Create tenant
 */
export async function createTenant(req: Request, res: Response) {
  try {
    const { name, slug, adminEmail, adminPassword } = req.body;

    // Validate input
    if (!name || !slug || !adminEmail || !adminPassword) {
      return res.render('admin/create-tenant', {
        user: req.user,
        error: 'All fields are required',
      });
    }

    // Check if slug exists
    const existing = await prisma.tenant.findUnique({ where: { slug } });
    if (existing) {
      return res.render('admin/create-tenant', {
        user: req.user,
        error: 'Slug already exists. Please choose a different one.',
      });
    }

    // Check if email already exists
    const existingUser = await prisma.user.findUnique({ 
      where: { email: adminEmail.toLowerCase() } 
    });
    if (existingUser) {
      return res.render('admin/create-tenant', {
        user: req.user,
        error: 'Email already exists. Please use a different email.',
      });
    }

    // Hash password first to catch any errors before creating tenant
    const hashedPassword = await hashPassword(adminPassword);

    // Create tenant and user in a transaction
    const tenant = await prisma.$transaction(async (tx) => {
      const newTenant = await tx.tenant.create({
        data: {
          name,
          slug,
          status: 'ACTIVE',
          receptionistConfig: {
            create: {},
          },
        },
      });

      await tx.user.create({
        data: {
          email: adminEmail.toLowerCase(),
          password: hashedPassword,
          role: 'TENANT_ADMIN',
          tenantId: newTenant.id,
        },
      });

      return newTenant;
    });

    console.log(`✅ Created tenant: ${tenant.name} (${tenant.slug})`);

    res.redirect('/admin/tenants?success=Tenant created successfully');
  } catch (error) {
    console.error('Create tenant error:', error);
    return res.render('admin/create-tenant', {
      user: req.user,
      error: 'Error creating tenant. Please try again.',
    });
  }
}

/**
 * Get tenant details
 */
export async function getTenant(req: Request, res: Response) {
  try {
    const { id } = req.params;

    const tenant = await prisma.tenant.findUnique({
      where: { id },
      include: {
        users: true,
        twilioNumbers: true,
        departments: true,
        transferTargets: true,
        receptionistConfig: true,
        businessHours: {
          orderBy: { dayOfWeek: 'asc' },
        },
      },
    });

    if (!tenant) {
      return res.status(404).send('Tenant not found');
    }

    res.render('admin/tenant-detail', {
      user: req.user,
      tenant,
    });
  } catch (error) {
    console.error('Get tenant error:', error);
    res.status(500).send('Error loading tenant');
  }
}

/**
 * Update tenant
 */
export async function updateTenant(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const { name, status } = req.body;

    await prisma.tenant.update({
      where: { id },
      data: { name, status },
    });

    res.redirect(`/admin/tenants/${id}`);
  } catch (error) {
    console.error('Update tenant error:', error);
    res.status(500).send('Error updating tenant');
  }
}

/**
 * Delete tenant
 */
export async function deleteTenant(req: Request, res: Response) {
  try {
    const { id } = req.params;

    await prisma.tenant.delete({
      where: { id },
    });

    res.redirect('/admin/tenants');
  } catch (error) {
    console.error('Delete tenant error:', error);
    res.status(500).send('Error deleting tenant');
  }
}

/**
 * List phone numbers
 */
export async function getNumbers(req: Request, res: Response) {
  try {
    const numbers = await prisma.twilioNumber.findMany({
      include: {
        tenant: true,
        _count: {
          select: {
            callSessions: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    const tenants = await prisma.tenant.findMany({
      where: { status: 'ACTIVE' },
      orderBy: { name: 'asc' },
    });

    res.render('admin/numbers', {
      user: req.user,
      numbers,
      tenants,
    });
  } catch (error) {
    console.error('Get numbers error:', error);
    res.status(500).send('Error loading numbers');
  }
}

/**
 * Assign number to tenant
 */
export async function assignNumber(req: Request, res: Response) {
  try {
    const { phoneNumber, tenantId, friendlyName, sid } = req.body;

    if (!phoneNumber || !tenantId) {
      return res.status(400).send('Phone number and tenant required');
    }

    await prisma.twilioNumber.create({
      data: {
        phoneNumber,
        tenantId,
        friendlyName,
        sid,
        status: 'ACTIVE',
      },
    });

    res.redirect('/admin/numbers');
  } catch (error) {
    console.error('Assign number error:', error);
    res.status(500).send('Error assigning number');
  }
}

/**
 * Unassign number
 */
export async function unassignNumber(req: Request, res: Response) {
  try {
    const { id } = req.params;

    await prisma.twilioNumber.delete({
      where: { id },
    });

    res.redirect('/admin/numbers');
  } catch (error) {
    console.error('Unassign number error:', error);
    res.status(500).send('Error unassigning number');
  }
}

/**
 * FAQ Management Page
 */
export async function getFAQsPage(req: Request, res: Response) {
  try {
    const { tenantId } = req.params;
    
    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
    });

    if (!tenant) {
      return res.status(404).send('Tenant not found');
    }

    res.render('admin/faqs', {
      user: req.user,
      tenant,
    });
  } catch (error) {
    console.error('FAQ page error:', error);
    res.status(500).send('Error loading FAQ page');
  }
}

/**
 * Knowledge Base Management Page
 */
export async function getKnowledgePage(req: Request, res: Response) {
  try {
    const { tenantId } = req.params;
    
    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
    });

    if (!tenant) {
      return res.status(404).send('Tenant not found');
    }

    res.render('admin/knowledge', {
      user: req.user,
      tenant,
    });
  } catch (error) {
    console.error('Knowledge page error:', error);
    res.status(500).send('Error loading knowledge page');
  }
}

/**
 * Call Flow Management Page
 */
export async function getFlowsPage(req: Request, res: Response) {
  try {
    const { tenantId } = req.params;
    
    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
    });

    if (!tenant) {
      return res.status(404).send('Tenant not found');
    }

    res.render('admin/flows', {
      user: req.user,
      tenant,
    });
  } catch (error) {
    console.error('Flows page error:', error);
    res.status(500).send('Error loading flows page');
  }
}
