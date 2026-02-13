import express from 'express';
import {
  handleIncomingCall,
  handleIVR,
  handleGather,
  handleTransferStatus,
  handleCallStatus,
  handleRecordingStatus,
} from '../controllers/twilioController';

const router = express.Router();

// Twilio Voice Webhooks
router.post('/voice', handleIncomingCall);
router.post('/ivr', handleIVR);
router.post('/gather', handleGather);
router.post('/transfer-status', handleTransferStatus);
router.post('/call-status', handleCallStatus);
router.post('/recording-status', handleRecordingStatus);

export default router;
