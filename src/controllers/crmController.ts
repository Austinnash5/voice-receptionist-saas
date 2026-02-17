import { Request, Response } from 'express';
import { contactService } from '../services/crm/contactService';
import { dealService } from '../services/crm/dealService';
import { prisma } from '../db/prisma';

export class CRMController {
  // ============================================
  // CONTACTS
  // ============================================

  async getContacts(req: Request, res: Response) {
    try {
      const tenantId = req.tenant!.id;
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 50;

      const filters = {
        search: req.query.search as string,
        lifecycle: req.query.lifecycle as string,
        rating: req.query.rating as string,
        ownerId: req.query.ownerId as string,
        companyId: req.query.companyId as string,
        source: req.query.source as string,
        tags: req.query.tags ? (req.query.tags as string).split(',') : undefined,
      };

      const result = await contactService.getContacts(tenantId, page, limit, filters);

      res.json(result);
    } catch (error) {
      console.error('Error fetching contacts:', error);
      res.status(500).json({ error: 'Failed to fetch contacts' });
    }
  }

  async getContact(req: Request, res: Response) {
    try {
      const tenantId = req.tenant!.id;
      const contactId = req.params.id;

      const contact = await contactService.getContactById(contactId, tenantId);

      if (!contact) {
        return res.status(404).json({ error: 'Contact not found' });
      }

      res.json(contact);
    } catch (error) {
      console.error('Error fetching contact:', error);
      res.status(500).json({ error: 'Failed to fetch contact' });
    }
  }

  async createContact(req: Request, res: Response) {
    try {
      const tenantId = req.tenant!.id;
      const userId = req.user!.id;

      const contact = await contactService.createContact(tenantId, req.body);

      // Log activity
      await contactService.logActivity(
        tenantId,
        contact.id,
        userId,
        'CUSTOM',
        'Contact created',
        `Contact ${contact.fullName || contact.email} was created`
      );

      res.status(201).json(contact);
    } catch (error) {
      console.error('Error creating contact:', error);
      res.status(500).json({ error: 'Failed to create contact' });
    }
  }

  async updateContact(req: Request, res: Response) {
    try {
      const tenantId = req.tenant!.id;
      const userId = req.user!.id;
      const contactId = req.params.id;

      const contact = await contactService.updateContact(contactId, tenantId, req.body);

      // Log activity
      await contactService.logActivity(
        tenantId,
        contact.id,
        userId,
        'CUSTOM',
        'Contact updated',
        undefined
      );

      res.json(contact);
    } catch (error) {
      console.error('Error updating contact:', error);
      res.status(500).json({ error: 'Failed to update contact' });
    }
  }

  async deleteContact(req: Request, res: Response) {
    try {
      const tenantId = req.tenant!.id;
      const contactId = req.params.id;

      await contactService.deleteContact(contactId, tenantId);

      res.json({ message: 'Contact deleted successfully' });
    } catch (error) {
      console.error('Error deleting contact:', error);
      res.status(500).json({ error: 'Failed to delete contact' });
    }
  }

  async convertLeadToContact(req: Request, res: Response) {
    try {
      const tenantId = req.tenant!.id;
      const leadId = req.params.leadId;
      const ownerId = req.body.ownerId || req.user!.id;

      const contact = await contactService.convertLeadToContact(leadId, tenantId, ownerId);

      res.json(contact);
    } catch (error) {
      console.error('Error converting lead:', error);
      res.status(500).json({ error: 'Failed to convert lead to contact' });
    }
  }

  async addContactNote(req: Request, res: Response) {
    try {
      const tenantId = req.tenant!.id;
      const userId = req.user!.id;
      const contactId = req.params.id;
      const { content, isPinned } = req.body;

      const note = await contactService.addNote(
        contactId,
        tenantId,
        userId,
        content,
        isPinned
      );

      res.status(201).json(note);
    } catch (error) {
      console.error('Error adding note:', error);
      res.status(500).json({ error: 'Failed to add note' });
    }
  }

  async getContactStats(req: Request, res: Response) {
    try {
      const tenantId = req.tenant!.id;
      const stats = await contactService.getContactStats(tenantId);
      res.json(stats);
    } catch (error) {
      console.error('Error fetching stats:', error);
      res.status(500).json({ error: 'Failed to fetch statistics' });
    }
  }

  async searchContacts(req: Request, res: Response) {
    try {
      const tenantId = req.tenant!.id;
      const query = req.query.q as string;
      const limit = parseInt(req.query.limit as string) || 10;

      if (!query) {
        return res.json([]);
      }

      const contacts = await contactService.searchContacts(tenantId, query, limit);
      res.json(contacts);
    } catch (error) {
      console.error('Error searching contacts:', error);
      res.status(500).json({ error: 'Failed to search contacts' });
    }
  }

  // ============================================
  // DEALS
  // ============================================

  async getDeals(req: Request, res: Response) {
    try {
      const tenantId = req.tenant!.id;
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 50;

      const filters = {
        search: req.query.search as string,
        status: req.query.status as string,
        pipelineId: req.query.pipelineId as string,
        stageId: req.query.stageId as string,
        ownerId: req.query.ownerId as string,
        contactId: req.query.contactId as string,
        companyId: req.query.companyId as string,
      };

      const result = await dealService.getDeals(tenantId, page, limit, filters);

      res.json(result);
    } catch (error) {
      console.error('Error fetching deals:', error);
      res.status(500).json({ error: 'Failed to fetch deals' });
    }
  }

  async getDeal(req: Request, res: Response) {
    try {
      const tenantId = req.tenant!.id;
      const dealId = req.params.id;

      const deal = await dealService.getDealById(dealId, tenantId);

      if (!deal) {
        return res.status(404).json({ error: 'Deal not found' });
      }

      res.json(deal);
    } catch (error) {
      console.error('Error fetching deal:', error);
      res.status(500).json({ error: 'Failed to fetch deal' });
    }
  }

  async createDeal(req: Request, res: Response) {
    try {
      const tenantId = req.tenant!.id;
      const userId = req.user!.id;

      const deal = await dealService.createDeal(tenantId, userId, req.body);

      res.status(201).json(deal);
    } catch (error) {
      console.error('Error creating deal:', error);
      res.status(500).json({ error: 'Failed to create deal' });
    }
  }

  async updateDeal(req: Request, res: Response) {
    try {
      const tenantId = req.tenant!.id;
      const userId = req.user!.id;
      const dealId = req.params.id;

      const deal = await dealService.updateDeal(dealId, tenantId, userId, req.body);

      res.json(deal);
    } catch (error) {
      console.error('Error updating deal:', error);
      res.status(500).json({ error: 'Failed to update deal' });
    }
  }

  async winDeal(req: Request, res: Response) {
    try {
      const tenantId = req.tenant!.id;
      const userId = req.user!.id;
      const dealId = req.params.id;

      const deal = await dealService.winDeal(dealId, tenantId, userId);

      res.json(deal);
    } catch (error) {
      console.error('Error winning deal:', error);
      res.status(500).json({ error: 'Failed to mark deal as won' });
    }
  }

  async loseDeal(req: Request, res: Response) {
    try {
      const tenantId = req.tenant!.id;
      const userId = req.user!.id;
      const dealId = req.params.id;
      const { lostReason } = req.body;

      const deal = await dealService.loseDeal(dealId, tenantId, userId, lostReason);

      res.json(deal);
    } catch (error) {
      console.error('Error losing deal:', error);
      res.status(500).json({ error: 'Failed to mark deal as lost' });
    }
  }

  async getPipelineView(req: Request, res: Response) {
    try {
      const tenantId = req.tenant!.id;
      const pipelineId = req.params.pipelineId;

      const view = await dealService.getPipelineView(tenantId, pipelineId);

      res.json(view);
    } catch (error) {
      console.error('Error fetching pipeline view:', error);
      res.status(500).json({ error: 'Failed to fetch pipeline view' });
    }
  }

  async getDealStats(req: Request, res: Response) {
    try {
      const tenantId = req.tenant!.id;
      const stats = await dealService.getDealStats(tenantId);
      res.json(stats);
    } catch (error) {
      console.error('Error fetching deal stats:', error);
      res.status(500).json({ error: 'Failed to fetch deal statistics' });
    }
  }

  // ============================================
  // COMPANIES
  // ============================================

  async getCompanies(req: Request, res: Response) {
    try {
      const tenantId = req.tenant!.id;
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 50;
      const skip = (page - 1) * limit;

      const where: any = { tenantId, status: 'ACTIVE' };

      if (req.query.search) {
        where.OR = [
          { name: { contains: req.query.search as string, mode: 'insensitive' } },
          { website: { contains: req.query.search as string, mode: 'insensitive' } },
        ];
      }

      const [companies, total] = await Promise.all([
        prisma.company.findMany({
          where,
          include: {
            _count: {
              select: {
                contacts: true,
                deals: true,
              },
            },
          },
          skip,
          take: limit,
          orderBy: { createdAt: 'desc' },
        }),
        prisma.company.count({ where }),
      ]);

      res.json({
        companies,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit),
        },
      });
    } catch (error) {
      console.error('Error fetching companies:', error);
      res.status(500).json({ error: 'Failed to fetch companies' });
    }
  }

  async createCompany(req: Request, res: Response) {
    try {
      const tenantId = req.tenant!.id;

      const company = await prisma.company.create({
        data: {
          tenantId,
          ...req.body,
        },
      });

      res.status(201).json(company);
    } catch (error) {
      console.error('Error creating company:', error);
      res.status(500).json({ error: 'Failed to create company' });
    }
  }

  // ============================================
  // TASKS
  // ============================================

  async getTasks(req: Request, res: Response) {
    try {
      const tenantId = req.tenant!.id;
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 50;
      const skip = (page - 1) * limit;

      const where: any = { tenantId };

     if (req.query.status) where.status = req.query.status;
      if (req.query.assigneeId) where.assigneeId = req.query.assigneeId;
      if (req.query.contactId) where.contactId = req.query.contactId;
      if (req.query.dealId) where.dealId = req.query.dealId;

      const [tasks, total] = await Promise.all([
        prisma.task.findMany({
          where,
          include: {
            assignee: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
              },
            },
            contact: {
              select: {
                id: true,
                fullName: true,
              },
            },
            deal: {
              select: {
                id: true,
                title: true,
              },
            },
          },
          skip,
          take: limit,
          orderBy: { dueDate: 'asc' },
        }),
        prisma.task.count({ where }),
      ]);

      res.json({
        tasks,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit),
        },
      });
    } catch (error) {
      console.error('Error fetching tasks:', error);
      res.status(500).json({ error: 'Failed to fetch tasks' });
    }
  }

  async createTask(req: Request, res: Response) {
    try {
      const tenantId = req.tenant!.id;
      const userId = req.user!.id;

      const task = await prisma.task.create({
        data: {
          tenantId,
          ownerId: userId,
          ...req.body,
        },
        include: {
          assignee: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
            },
          },
        },
      });

      res.status(201).json(task);
    } catch (error) {
      console.error('Error creating task:', error);
      res.status(500).json({ error: 'Failed to create task' });
    }
  }

  async updateTask(req: Request, res: Response) {
    try {
      const taskId = req.params.id;

      const task = await prisma.task.update({
        where: { id: taskId },
        data: req.body,
        include: {
          assignee: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
            },
          },
        },
      });

      res.json(task);
    } catch (error) {
      console.error('Error updating task:', error);
      res.status(500).json({ error: 'Failed to update task' });
    }
  }

  // ============================================
  // TAGS
  // ============================================

  async getTags(req: Request, res: Response) {
    try {
      const tenantId = req.tenant!.id;

      const tags = await prisma.tag.findMany({
        where: { tenantId },
        include: {
          _count: {
            select: {
              contacts: true,
            },
          },
        },
        orderBy: { name: 'asc' },
      });

      res.json(tags);
    } catch (error) {
      console.error('Error fetching tags:', error);
      res.status(500).json({ error: 'Failed to fetch tags' });
    }
  }

  async createTag(req: Request, res: Response) {
    try {
      const tenantId = req.tenant!.id;
      const { name, color, category } = req.body;

      const tag = await prisma.tag.create({
        data: {
          tenantId,
          name,
          color,
          category,
        },
      });

      res.status(201).json(tag);
    } catch (error) {
      console.error('Error creating tag:', error);
      res.status(500).json({ error: 'Failed to create tag' });
    }
  }

  // ============================================
  // PIPELINES
  // ============================================

  async getPipelines(req: Request, res: Response) {
    try {
      const tenantId = req.tenant!.id;

      const pipelines = await prisma.pipeline.findMany({
        where: { tenantId, isActive: true },
        include: {
          stages: {
            orderBy: { order: 'asc' },
          },
          _count: {
            select: {
              deals: true,
            },
          },
        },
        orderBy: { createdAt: 'asc' },
      });

      res.json(pipelines);
    } catch (error) {
      console.error('Error fetching pipelines:', error);
      res.status(500).json({ error: 'Failed to fetch pipelines' });
    }
  }

  // ============================================
  // PAGE RENDERING METHODS
  // ============================================

  async getCRMDashboard(req: Request, res: Response) {
    try {
      const tenantId = req.tenant!.id;
      const stats = await contactService.getContactStats(tenantId);
      const dealStats = await dealService.getDealStats(tenantId);

      res.render('tenant/crm/dashboard', {
        user: req.user,
        tenant: req.tenant,
        permissions: req.userPermissions || [],
        stats: { ...stats, ...dealStats },
      });
    } catch (error) {
      console.error('Error rendering CRM dashboard:', error);
      res.status(500).send('Failed to load CRM dashboard');
    }
  }

  async getContactsPage(req: Request, res: Response) {
    try {
      const tenantId = req.tenant!.id;
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 50;

      const filters = {
        search: req.query.search as string,
        lifecycle: req.query.lifecycle as string,
        rating: req.query.rating as string,
      };

      const result = await contactService.getContacts(tenantId, page, limit, filters);

      res.render('tenant/crm/contacts', {
        user: req.user,
        tenant: req.tenant,
        permissions: req.userPermissions || [],
        contacts: result.contacts,
        pagination: result.pagination,
        ...filters,
        page,
        limit,
      });
    } catch (error) {
      console.error('Error rendering contacts page:', error);
      res.status(500).send('Failed to load contacts');
    }
  }

  async getContactDetailPage(req: Request, res: Response) {
    try {
      const tenantId = req.tenant!.id;
      const contactId = req.params.id;

      const contact = await contactService.getContactById(contactId, tenantId);

      if (!contact) {
        return res.status(404).send('Contact not found');
      }

      res.render('tenant/crm/contact-detail', {
        user: req.user,
        tenant: req.tenant,
        permissions: req.userPermissions || [],
        contact,
      });
    } catch (error) {
      console.error('Error rendering contact detail:', error);
      res.status(500).send('Failed to load contact');
    }
  }

  async getContactNewPage(req: Request, res: Response) {
    try {
      const tenantId = req.tenant!.id;

      // Fetch companies, users, and tags for dropdowns
      const [companies, users, availableTags] = await Promise.all([
        prisma.company.findMany({ where: { tenantId }, orderBy: { name: 'asc' } }),
        prisma.user.findMany({ where: { tenantId, isActive: true }, orderBy: { firstName: 'asc' } }),
        prisma.tag.findMany({ where: { tenantId }, orderBy: { name: 'asc' } }),
      ]);

      res.render('tenant/crm/contact-new', {
        user: req.user,
        tenant: req.tenant,
        permissions: req.userPermissions || [],
        companies,
        users,
        availableTags,
      });
    } catch (error) {
      console.error('Error rendering new contact page:', error);
      res.status(500).send('Failed to load form');
    }
  }

  async getContactEditPage(req: Request, res: Response) {
    try {
      const tenantId = req.tenant!.id;
      const contactId = req.params.id;

      const [contact, companies, users, availableTags] = await Promise.all([
        contactService.getContactById(contactId, tenantId),
        prisma.company.findMany({ where: { tenantId }, orderBy: { name: 'asc' } }),
        prisma.user.findMany({ where: { tenantId, isActive: true }, orderBy: { firstName: 'asc' } }),
        prisma.tag.findMany({ where: { tenantId }, orderBy: { name: 'asc' } }),
      ]);

      if (!contact) {
        return res.status(404).send('Contact not found');
      }

      res.render('tenant/crm/contact-edit', {
        user: req.user,
        tenant: req.tenant,
        permissions: req.userPermissions || [],
        contact,
        companies,
        users,
        availableTags,
      });
    } catch (error) {
      console.error('Error rendering edit contact page:', error);
      res.status(500).send('Failed to load form');
    }
  }

  async createContactPage(req: Request, res: Response) {
    try {
      const tenantId = req.tenant!.id;
      const userId = req.user!.id;

      const contactData = {
        ...req.body,
        createdById: userId,
      };

      const contact = await contactService.createContact(tenantId, contactData);
      res.redirect(`/tenant/crm/contacts/${contact.id}`);
    } catch (error) {
      console.error('Error creating contact:', error);
      res.status(500).send('Failed to create contact');
    }
  }

  async updateContactPage(req: Request, res: Response) {
    try {
      const tenantId = req.tenant!.id;
      const contactId = req.params.id;

      await contactService.updateContact(contactId, tenantId, req.body);
      res.redirect(`/tenant/crm/contacts/${contactId}`);
    } catch (error) {
      console.error('Error updating contact:', error);
      res.status(500).send('Failed to update contact');
    }
  }

  async getDealsPage(req: Request, res: Response) {
    try {
      const tenantId = req.tenant!.id;
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 50;

      const filters = {
        search: req.query.search as string,
        status: req.query.status as string,
        pipelineId: req.query.pipelineId as string,
        ownerId: req.query.ownerId as string,
      };

      const [result, stats, pipelines, users] = await Promise.all([
        dealService.getDeals(tenantId, page, limit, filters),
        dealService.getDealStats(tenantId),
        prisma.pipeline.findMany({ where: { tenantId, isActive: true } }),
        prisma.user.findMany({ where: { tenantId, isActive: true }, orderBy: { firstName: 'asc' } }),
      ]);

      res.render('tenant/crm/deals', {
        user: req.user,
        tenant: req.tenant,
        permissions: req.userPermissions || [],
        deals: result.deals,
        pagination: result.pagination,
        stats,
        pipelines,
        users,
        ...filters,
        page,
        limit,
      });
    } catch (error) {
      console.error('Error rendering deals page:', error);
      res.status(500).send('Failed to load deals');
    }
  }

  async getDealPipelinePage(req: Request, res: Response) {
    try {
      const tenantId = req.tenant!.id;
      const pipelineId = req.query.pipelineId as string;

      // Get all pipelines
      const pipelines = await prisma.pipeline.findMany({
        where: { tenantId, isActive: true },
        orderBy: { createdAt: 'asc' },
      });

      // Use first pipeline if none specified
      const selectedPipelineId = pipelineId || pipelines[0]?.id;

      if (!selectedPipelineId) {
        // Initialize default pipeline if none exist
        await dealService.initializeDefaultPipeline(tenantId);
        return res.redirect('/tenant/crm/deals/pipeline');
      }

      const [pipeline, pipelineView] = await Promise.all([
        prisma.pipeline.findUnique({ where: { id: selectedPipelineId } }),
        dealService.getPipelineView(selectedPipelineId, tenantId),
      ]);

      res.render('tenant/crm/deal-pipeline', {
        user: req.user,
        tenant: req.tenant,
        permissions: req.userPermissions || [],
        pipeline,
        pipelines,
        pipelineView,
      });
    } catch (error) {
      console.error('Error rendering pipeline page:', error);
      res.status(500).send('Failed to load pipeline');
    }
  }

  async getDealDetailPage(req: Request, res: Response) {
    try {
      const tenantId = req.tenant!.id;
      const dealId = req.params.id;

      const deal = await dealService.getDealById(dealId, tenantId);

      if (!deal) {
        return res.status(404).send('Deal not found');
      }

      res.render('tenant/crm/deal-detail', {
        user: req.user,
        tenant: req.tenant,
        permissions: req.userPermissions || [],
        deal,
      });
    } catch (error) {
      console.error('Error rendering deal detail:', error);
      res.status(500).send('Failed to load deal');
    }
  }

  async getDealNewPage(req: Request, res: Response) {
    try {
      const tenantId = req.tenant!.id;

      const [pipelines, contacts, companies, users] = await Promise.all([
        prisma.pipeline.findMany({
          where: { tenantId, isActive: true },
          include: { stages: { orderBy: { order: 'asc' } } },
        }),
        prisma.contact.findMany({
          where: { tenantId, status: { not: 'DELETED' } },
          orderBy: { firstName: 'asc' },
        }),
        prisma.company.findMany({ where: { tenantId }, orderBy: { name: 'asc' } }),
        prisma.user.findMany({ where: { tenantId, isActive: true }, orderBy: { firstName: 'asc' } }),
      ]);

      res.render('tenant/crm/deal-new', {
        user: req.user,
        tenant: req.tenant,
        permissions: req.userPermissions || [],
        pipelines,
        contacts,
        companies,
        users,
        pipelineId: req.query.pipelineId as string,
        stageId: req.query.stageId as string,
      });
    } catch (error) {
      console.error('Error rendering new deal page:', error);
      res.status(500).send('Failed to load form');
    }
  }

  async createDealPage(req: Request, res: Response) {
    try {
      const tenantId = req.tenant!.id;
      const userId = req.user!.id;

      const dealData = {
        ...req.body,
        createdById: userId,
      };

      const deal = await dealService.createDeal(tenantId, dealData);
      res.redirect(`/tenant/crm/deals/${deal.id}`);
    } catch (error) {
      console.error('Error creating deal:', error);
      res.status(500).send('Failed to create deal');
    }
  }

  async getCompaniesPage(req: Request, res: Response) {
    try {
      const tenantId = req.tenant!.id;
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 50;
      const search = req.query.search as string;

      const where: any = { tenantId };
      if (search) {
        where.OR = [
          { name: { contains: search, mode: 'insensitive' } },
          { website: { contains: search, mode: 'insensitive' } },
        ];
      }

      const [companies, total] = await Promise.all([
        prisma.company.findMany({
          where,
          include: {
            _count: {
              select: { contacts: true, deals: true },
            },
          },
          skip: (page - 1) * limit,
          take: limit,
          orderBy: { name: 'asc' },
        }),
        prisma.company.count({ where }),
      ]);

      res.render('tenant/crm/companies', {
        user: req.user,
        tenant: req.tenant,
        permissions: req.userPermissions || [],
        companies,
        pagination: {
          total,
          page,
          limit,
          totalPages: Math.ceil(total / limit),
        },
        search,
        page,
        limit,
      });
    } catch (error) {
      console.error('Error rendering companies page:', error);
      res.status(500).send('Failed to load companies');
    }
  }

  async getTasksPage(req: Request, res: Response) {
    try {
      const tenantId = req.tenant!.id;
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 50;

      const filters = {
        search: req.query.search as string,
        status: req.query.status as string,
        priority: req.query.priority as string,
        assigneeId: req.query.assigneeId as string,
      };

      const where: any = { tenantId };
      if (filters.search) {
        where.OR = [
          { title: { contains: filters.search, mode: 'insensitive' } },
          { description: { contains: filters.search, mode: 'insensitive' } },
        ];
      }
      if (filters.status) where.status = filters.status;
      if (filters.priority) where.priority = filters.priority;
      if (filters.assigneeId) where.assigneeId = filters.assigneeId;

      const [tasks, total, users] = await Promise.all([
        prisma.task.findMany({
          where,
          include: {
            assignee: true,
            contact: true,
            deal: true,
          },
          skip: (page - 1) * limit,
          take: limit,
          orderBy: { dueDate: 'asc' },
        }),
        prisma.task.count({ where }),
        prisma.user.findMany({ where: { tenantId, isActive: true }, orderBy: { firstName: 'asc' } }),
      ]);

      // Calculate stats
      const stats = {
        totalTasks: total,
        todoTasks: await prisma.task.count({ where: { tenantId, status: 'TODO' } }),
        inProgressTasks: await prisma.task.count({ where: { tenantId, status: 'IN_PROGRESS' } }),
        completedTasks: await prisma.task.count({ where: { tenantId, status: 'COMPLETED' } }),
        overdueTasks: await prisma.task.count({
          where: {
            tenantId,
            status: { not: 'COMPLETED' },
            dueDate: { lt: new Date() },
          },
        }),
      };

      res.render('tenant/crm/tasks', {
        user: req.user,
        tenant: req.tenant,
        permissions: req.userPermissions || [],
        tasks,
        pagination: {
          total,
          page,
          limit,
          totalPages: Math.ceil(total / limit),
        },
        stats,
        users,
        ...filters,
        page,
        limit,
      });
    } catch (error) {
      console.error('Error rendering tasks page:', error);
      res.status(500).send('Failed to load tasks');
    }
  }
}

export const crmController = new CRMController();

// Export page rendering functions
export const {
  getCRMDashboard,
  getContactsPage,
  getContactDetailPage,
  getContactNewPage,
  getContactEditPage,
  createContactPage,
  updateContactPage,
  getDealsPage,
  getDealPipelinePage,
  getDealDetailPage,
  getDealNewPage,
  createDealPage,
  getCompaniesPage,
  getTasksPage,
} = crmController;
