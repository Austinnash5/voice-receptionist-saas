import { prisma } from '../../db/prisma';
import { Prisma } from '@prisma/client';

export interface ContactFilters {
  search?: string;
  status?: string;
  lifecycle?: string;
  rating?: string;
  ownerId?: string;
  companyId?: string;
  tags?: string[];
  source?: string;
  createdFrom?: Date;
  createdTo?: Date;
}

export interface ContactCreateData {
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  mobile?: string;
  title?: string;
  department?: string;
  website?: string;
  address?: string;
  city?: string;
  state?: string;
  zipCode?: string;
  country?: string;
  lifecycle?: string;
  source?: string;
  rating?: string;
  ownerId?: string;
  companyId?: string;
  leadId?: string;
  notes?: string;
  customFields?: any;
  tags?: string[]; // Tag IDs
}

export class ContactService {
  /**
   * Get paginated contacts with filters
   */
  async getContacts(
    tenantId: string,
    page: number = 1,
    limit: number = 50,
    filters: ContactFilters = {}
  ) {
    const skip = (page - 1) * limit;

    // Build where clause
    const where: Prisma.ContactWhereInput = {
      tenantId,
      status: 'ACTIVE',
    };

    // Apply filters
    if (filters.search) {
      where.OR = [
        { firstName: { contains: filters.search, mode: 'insensitive' } },
        { lastName: { contains: filters.search, mode: 'insensitive' } },
        { fullName: { contains: filters.search, mode: 'insensitive' } },
        { email: { contains: filters.search, mode: 'insensitive' } },
        { phone: { contains: filters.search } },
        { mobile: { contains: filters.search } },
      ];
    }

    if (filters.lifecycle) {
      where.lifecycle = filters.lifecycle as any;
    }

    if (filters.rating) {
      where.rating = filters.rating as any;
    }

    if (filters.ownerId) {
      where.ownerId = filters.ownerId;
    }

    if (filters.companyId) {
      where.companyId = filters.companyId;
    }

    if (filters.source) {
      where.source = filters.source;
    }

    if (filters.tags && filters.tags.length > 0) {
      where.tags = {
        some: {
          tagId: {
            in: filters.tags,
          },
        },
      };
    }

    if (filters.createdFrom || filters.createdTo) {
      where.createdAt = {};
      if (filters.createdFrom) where.createdAt.gte = filters.createdFrom;
      if (filters.createdTo) where.createdAt.lte = filters.createdTo;
    }

    // Get total count
    const total = await prisma.contact.count({ where });

    // Get contacts
    const contacts = await prisma.contact.findMany({
      where,
      include: {
        owner: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
        company: {
          select: {
            id: true,
            name: true,
          },
        },
        tags: {
          include: {
            tag: true,
          },
        },
        _count: {
          select: {
            notes: true,
            activities: true,
            deals: true,
            tasks: true,
          },
        },
      },
      skip,
      take: limit,
      orderBy: { createdAt: 'desc' },
    });

    return {
      contacts,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Get contact by ID with full details
   */
  async getContactById(contactId: string, tenantId: string) {
    const contact = await prisma.contact.findFirst({
      where: {
        id: contactId,
        tenantId,
      },
      include: {
        owner: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
        company: {
          select: {
            id: true,
            name: true,
            website: true,
            industry: true,
          },
        },
        lead: true,
        tags: {
          include: {
            tag: true,
          },
        },
        notes: {
          include: {
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
              },
            },
          },
          orderBy: {
            createdAt: 'desc',
          },
        },
        activities: {
          include: {
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
              },
            },
          },
          orderBy: {
            occurredAt: 'desc',
          },
          take: 20,
        },
        deals: {
          include: {
            pipeline: true,
            stage: true,
          },
          orderBy: {
            createdAt: 'desc',
          },
        },
        tasks: {
          include: {
            assignee: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
              },
            },
          },
          where: {
            status: {
              not: 'COMPLETED',
            },
          },
          orderBy: {
            dueDate: 'asc',
          },
        },
      },
    });

    return contact;
  }

  /**
   * Create new contact
   */
  async createContact(tenantId: string, data: ContactCreateData) {
    // Compute full name
    const fullName =
      data.firstName && data.lastName
        ? `${data.firstName} ${data.lastName}`
        : data.firstName || data.lastName || undefined;

    const contact = await prisma.contact.create({
      data: {
        tenantId,
        firstName: data.firstName,
        lastName: data.lastName,
        fullName,
        email: data.email,
        phone: data.phone,
        mobile: data.mobile,
        title: data.title,
        department: data.department,
        website: data.website,
        address: data.address,
        city: data.city,
        state: data.state,
        zipCode: data.zipCode,
        country: data.country,
        lifecycle: (data.lifecycle as any) || 'LEAD',
        source: data.source || 'manual',
        rating: data.rating as any,
        ownerId: data.ownerId,
        companyId: data.companyId,
        leadId: data.leadId,
        notes: data.notes,
        customFields: data.customFields,
        tags: data.tags
          ? {
              create: data.tags.map((tagId) => ({
                tagId,
              })),
            }
          : undefined,
      },
      include: {
        owner: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
        company: {
          select: {
            id: true,
            name: true,
          },
        },
        tags: {
          include: {
            tag: true,
          },
        },
      },
    });

    return contact;
  }

  /**
   * Update contact
   */
  async updateContact(
    contactId: string,
    tenantId: string,
    data: Partial<ContactCreateData>
  ) {
    // Compute full name if first or last name changed
    let fullName: string | undefined;
    if (data.firstName !== undefined || data.lastName !== undefined) {
      const contact = await prisma.contact.findFirst({
        where: { id: contactId, tenantId },
      });
      if (contact) {
        const firstName = data.firstName ?? contact.firstName;
        const lastName = data.lastName ?? contact.lastName;
        fullName =
          firstName && lastName
            ? `${firstName} ${lastName}`
            : firstName || lastName || undefined;
      }
    }

    // Handle tags separately
    if (data.tags !== undefined) {
      // Remove existing tags
      await prisma.contactTag.deleteMany({
        where: { contactId },
      });

      // Add new tags
      if (data.tags.length > 0) {
        await prisma.contactTag.createMany({
          data: data.tags.map((tagId) => ({
            contactId,
            tagId,
          })),
        });
      }

      // Remove tags from update data
      delete data.tags;
    }

    const contact = await prisma.contact.update({
      where: {
        id: contactId,
      },
      data: {
        ...data,
        fullName,
        updatedAt: new Date(),
      },
      include: {
        owner: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
        company: {
          select: {
            id: true,
            name: true,
          },
        },
        tags: {
          include: {
            tag: true,
          },
        },
      },
    });

    return contact;
  }

  /**
   * Delete contact (soft delete by setting status to DELETED)
   */
  async deleteContact(contactId: string, tenantId: string) {
    return prisma.contact.update({
      where: {
        id: contactId,
      },
      data: {
        status: 'DELETED',
      },
    });
  }

  /**
   * Archive contact
   */
  async archiveContact(contactId: string, tenantId: string) {
    return prisma.contact.update({
      where: {
        id: contactId,
      },
      data: {
        status: 'ARCHIVED',
      },
    });
  }

  /**
   * Restore archived contact
   */
  async restoreContact(contactId: string, tenantId: string) {
    return prisma.contact.update({
      where: {
        id: contactId,
      },
      data: {
        status: 'ACTIVE',
      },
    });
  }

  /**
   * Convert lead to contact
   */
  async convertLeadToContact(leadId: string, tenantId: string, ownerId?: string) {
    const lead = await prisma.lead.findFirst({
      where: {
        id: leadId,
        tenantId,
      },
      include: {
        customFields: true,
      },
    });

    if (!lead) throw new Error('Lead not found');

    // Check if contact already exists
    const existingContact = await prisma.contact.findFirst({
      where: {
        leadId,
        tenantId,
      },
    });

    if (existingContact) {
      return existingContact;
    }

    // Parse name
    let firstName: string | undefined;
    let lastName: string | undefined;
    if (lead.name) {
      const parts = lead.name.trim().split(' ');
      firstName = parts[0];
      lastName = parts.slice(1).join(' ') || undefined;
    }

    // Convert custom fields to customFields JSON
    const customFields: Record<string, any> = {};
    for (const field of lead.customFields) {
      customFields[field.label] = field.value;
    }

    // Create contact
    const contact = await prisma.contact.create({
      data: {
        tenantId,
        leadId,
        firstName,
        lastName,
        fullName: lead.name || undefined,
        email: lead.email || undefined,
        phone: lead.phone || undefined,
        lifecycle: 'LEAD',
        source: lead.source,
        notes: lead.notes || undefined,
        ownerId,
        customFields: Object.keys(customFields).length > 0 ? customFields : undefined,
      },
    });

    // Update lead status
    await prisma.lead.update({
      where: { id: leadId },
      data: { status: 'CONVERTED' },
    });

    return contact;
  }

  /**
   * Add note to contact
   */
  async addNote(
    contactId: string,
    tenantId: string,
    userId: string,
    content: string,
    isPinned: boolean = false
  ) {
    return prisma.note.create({
      data: {
        tenantId,
        contactId,
        createdBy: userId,
        content,
        isPinned,
      },
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    });
  }

  /**
   * Log activity for contact
   */
  async logActivity(
    tenantId: string,
    contactId: string,
    userId: string,
    activityType: string,
    title: string,
    description?: string,
    metadata?: any
  ) {
    return prisma.activity.create({
      data: {
        tenantId,
        contactId,
        createdBy: userId,
        activityType: activityType as any,
        title,
        description,
        metadata,
      },
    });
  }

  /**
   * Get contact statistics
   */
  async getContactStats(tenantId: string) {
    const [
      total,
      leads,
      opportunities,
      customers,
      activeDeals,
      openTasks,
      recentActivity,
    ] = await Promise.all([
      prisma.contact.count({
        where: { tenantId, status: 'ACTIVE' },
      }),
      prisma.contact.count({
        where: { tenantId, status: 'ACTIVE', lifecycle: 'LEAD' },
      }),
      prisma.contact.count({
        where: { tenantId, status: 'ACTIVE', lifecycle: 'OPPORTUNITY' },
      }),
      prisma.contact.count({
        where: { tenantId, status: 'ACTIVE', lifecycle: 'CUSTOMER' },
      }),
      prisma.deal.count({
        where: { tenantId, status: 'OPEN' },
      }),
      prisma.task.count({
        where: { tenantId, status: { in: ['TODO', 'IN_PROGRESS'] } },
      }),
      prisma.activity.count({
        where: {
          tenantId,
          occurredAt: {
            gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // Last 7 days
          },
        },
      }),
    ]);

    return {
      total,
      leads,
      opportunities,
      customers,
      activeDeals,
      openTasks,
      recentActivity,
    };
  }

  /**
   * Search contacts
   */
  async searchContacts(tenantId: string, query: string, limit: number = 10) {
    return prisma.contact.findMany({
      where: {
        tenantId,
        status: 'ACTIVE',
        OR: [
          { firstName: { contains: query, mode: 'insensitive' } },
          { lastName: { contains: query, mode: 'insensitive' } },
          { fullName: { contains: query, mode: 'insensitive' } },
          { email: { contains: query, mode: 'insensitive' } },
          { phone: { contains: query } },
          { mobile: { contains: query } },
        ],
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        fullName: true,
        email: true,
        phone: true,
        lifecycle: true,
        company: {
          select: {
            name: true,
          },
        },
      },
      take: limit,
    });
  }
}

export const contactService = new ContactService();
