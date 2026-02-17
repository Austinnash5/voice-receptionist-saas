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
}

export const crmController = new CRMController();
