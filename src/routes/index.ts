import express, { Request, Response } from 'express';
import { requireAuth, loginUser } from '../middleware/auth';
import twilioRoutes from './twilio.routes';
import adminRoutes from './admin.routes';
import tenantRoutes from './tenant.routes';
import knowledgeRoutes from './knowledge.routes';

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

// Twilio webhooks (public)
router.use('/twilio', twilioRoutes);

// Protected routes
router.use('/admin', adminRoutes);
router.use('/tenant', tenantRoutes);
router.use('/api', requireAuth, knowledgeRoutes);

export default router;
