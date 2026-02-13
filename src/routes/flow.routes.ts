import express from 'express';
import {
  getFlows,
  getFlow,
  createFlow,
  updateFlow,
  deleteFlow,
  toggleFlowStatus,
  duplicateFlow,
} from '../controllers/flowController';
import { requireAuth } from '../middleware/auth';

const router = express.Router();

// All flow routes require authentication
router.use(requireAuth);

// Flow CRUD operations
router.get('/tenants/:tenantId/flows', getFlows);
router.get('/flows/:flowId', getFlow);
router.post('/tenants/:tenantId/flows', createFlow);
router.put('/flows/:flowId', updateFlow);
router.delete('/flows/:flowId', deleteFlow);

// Flow actions
router.post('/flows/:flowId/toggle', toggleFlowStatus);
router.post('/flows/:flowId/duplicate', duplicateFlow);

export default router;
