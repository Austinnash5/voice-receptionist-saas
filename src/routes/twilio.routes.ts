import express from 'express';
import {
  handleIncomingCall,
  handleIVR,
  handleGather,
  handleFlowGather,
  handleFlowStep,
  handleTransferStatus,
  handleCallStatus,
  handleRecordingStatus,
} from '../controllers/twilioController';

const router = express.Router();

// Twilio Voice Webhooks
router.post('/voice', handleIncomingCall);
router.post('/ivr', handleIVR);
router.post('/gather', handleGather);
router.post('/flow-gather', handleFlowGather);
router.post('/flow-step/:stepId', handleFlowStep);
router.post('/transfer-status', handleTransferStatus);
router.post('/call-status', handleCallStatus);
router.post('/recording-status', handleRecordingStatus);

export default router;
