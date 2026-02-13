import express, { Request, Response } from 'express';
import { requireAuth, loginUser } from '../middleware/auth';
import prisma from '../db/prisma';
import twilioRoutes from './twilio.routes';
import adminRoutes from './admin.routes';
import tenantRoutes from './tenant.routes';
import knowledgeRoutes from './knowledge.routes';
import flowRoutes from './flow.routes';
import analyticsRoutes from './analytics.routes';
import websiteRoutes from './website.routes';

const router = express.Router();

// Public routes
router.get('/', (req: Request, res: Response) => {
  if (req.session && req.session.userId) {
    // Redirect based on role
    if (req.user?.role === 'SUPER_ADMIN') {
      return res.redirect('/admin/dashboard');
    } else {
      return res.redirect('/tenant/dashboard');
    }
  }
  res.redirect('/login');
});

router.get('/login', (req: Request, res: Response) => {
  res.render('login', { error: null });
});

router.post('/login', async (req: Request, res: Response) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.render('login', { error: 'Email and password required' });
  }

  const result = await loginUser(email, password);

  if (!result.success) {
    return res.render('login', { error: result.error });
  }

  // Set session
  if (req.session) {
    req.session.userId = result.user!.id;
  }

  // Redirect based on role
  if (result.user!.role === 'SUPER_ADMIN') {
    return res.redirect('/admin/dashboard');
  } else {
    return res.redirect('/tenant/dashboard');
  }
});

router.get('/logout', (req: Request, res: Response) => {
  if (req.session) {
    req.session.destroy(() => {
      res.redirect('/login');
    });
  } else {
    res.redirect('/login');
  }
});

// Health check
router.get('/health', (req: Request, res: Response) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Database status check (requires auth)
router.get('/db-status', requireAuth, async (req: Request, res: Response) => {
  try {
    const checks = {
      database: false,
      tables: {
        tenants: false,
        users: false,
        faqs: false,
        knowledgeBase: false,
        callFlows: false,
      },
      timestamp: new Date().toISOString(),
    };

    // Check database connection
    await prisma.$queryRaw`SELECT 1`;
    checks.database = true;

    // Check each table exists
    try {
      await prisma.tenant.findFirst();
      checks.tables.tenants = true;
    } catch (e) {}

    try {
      await prisma.user.findFirst();
      checks.tables.users = true;
    } catch (e) {}

    try {
      await prisma.fAQ.findFirst();
      checks.tables.faqs = true;
    } catch (e) {}

    try {
      await prisma.knowledgeBaseEntry.findFirst();
      checks.tables.knowledgeBase = true;
    } catch (e) {}

    try {
      await prisma.callFlow.findFirst();
      checks.tables.callFlows = true;
    } catch (e) {}

    const allTablesExist = Object.values(checks.tables).every(v => v);
    const status = allTablesExist ? 'healthy' : 'needs_migration';

    res.json({
      status,
      checks,
      message: allTablesExist 
        ? 'All tables exist' 
        : 'Some tables are missing. Run: docker compose run app npx prisma db push',
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      error: 'Database connection failed',
      message: String(error),
    });
  }
});

// Twilio webhooks (public)
router.use('/twilio', twilioRoutes);

// Protected routes
router.use('/admin', adminRoutes);
router.use('/tenant', tenantRoutes);
router.use('/api', requireAuth, knowledgeRoutes);
router.use('/api', flowRoutes);
router.use('/api/tenants/:tenantId/analytics', requireAuth, analyticsRoutes);
router.use('/api/tenants/:tenantId/websites', requireAuth, websiteRoutes);

export default router;
