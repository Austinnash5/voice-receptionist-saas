import { Router } from 'express';
import {
  listFAQs,
  createFAQ,
  updateFAQ,
  deleteFAQ,
  listKnowledge,
  createKnowledge,
  updateKnowledge,
  deleteKnowledge,
  listFlows,
  createFlow,
  updateFlow,
  deleteFlow,
} from '../controllers/knowledgeController';

const router = Router();

// FAQ routes
router.get('/tenant/:tenantId/faqs', listFAQs);
router.post('/tenant/:tenantId/faqs', createFAQ);
router.put('/tenant/:tenantId/faqs/:faqId', updateFAQ);
router.delete('/tenant/:tenantId/faqs/:faqId', deleteFAQ);

// Knowledge Base routes
router.get('/tenant/:tenantId/knowledge', listKnowledge);
router.post('/tenant/:tenantId/knowledge', createKnowledge);
router.put('/tenant/:tenantId/knowledge/:entryId', updateKnowledge);
router.delete('/tenant/:tenantId/knowledge/:entryId', deleteKnowledge);

// Call Flow routes
router.get('/tenant/:tenantId/flows', listFlows);
router.post('/tenant/:tenantId/flows', createFlow);
router.put('/tenant/:tenantId/flows/:flowId', updateFlow);
router.delete('/tenant/:tenantId/flows/:flowId', deleteFlow);

export default router;
