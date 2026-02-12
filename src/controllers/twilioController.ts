import { Request, Response } from 'express';
import prisma from '../db/prisma';
import { callService } from '../services/call/callService';
import { stateMachine } from '../services/ai/stateMachine';
import { attemptTransfer } from '../services/ai/toolFunctions';
import { 
  createGreetingTwiML, 
  createGatherResponseTwiML,
  createTransferTwiML,
  createEndCallTwiML 
} from '../services/twilio/twimlBuilder';
import { JobProcessor } from '../services/jobs/jobProcessor';
import { env } from '../config/env';

/**
 * Handle incoming voice call
 */
export async function handleIncomingCall(req: Request, res: Response) {
  try {
    const { CallSid, From, To, Direction } = req.body;

    console.log(`📞 Incoming call: ${CallSid} from ${From} to ${To}`);

    // Find which tenant owns this number
    const twilioNumber = await prisma.twilioNumber.findUnique({
      where: { phoneNumber: To },
      include: {
        tenant: {
          include: {
            receptionistConfig: true,
          },
        },
      },
    });

    if (!twilioNumber || !twilioNumber.tenant) {
      console.error(`No tenant found for number ${To}`);
      res.type('text/xml');
      return res.send('<Response><Say>Sorry, this number is not configured.</Say><Hangup/></Response>');
    }

    const config = twilioNumber.tenant.receptionistConfig;
    const greetingMessage = config?.greetingMessage || 
      'Thank you for calling. This call may be recorded. How can I help you today?';

    // Create call session
    const session = await callService.createCallSession({
      tenantId: twilioNumber.tenantId,
      twilioNumberId: twilioNumber.id,
      callSid: CallSid,
      fromNumber: From,
      toNumber: To,
      direction: Direction || 'inbound',
    });

    console.log(`✅ Created call session: ${session.id}`);

    // Return greeting TwiML
    const gatherUrl = `${env.BASE_URL}/twilio/gather`;
    const twiml = createGreetingTwiML(greetingMessage, gatherUrl);

    res.type('text/xml');
    res.send(twiml);
  } catch (error) {
    console.error('Incoming call handler error:', error);
    res.type('text/xml');
    res.send('<Response><Say>We are experiencing technical difficulties. Please try again later.</Say><Hangup/></Response>');
  }
}

/**
 * Handle speech gather callback
 */
export async function handleGather(req: Request, res: Response) {
  try {
    const { CallSid, SpeechResult, Confidence } = req.body;

    console.log(`🎤 Gather result for ${CallSid}: "${SpeechResult}" (confidence: ${Confidence})`);

    if (!SpeechResult || SpeechResult.trim() === '') {
      // No speech detected - retry
      const gatherUrl = `${env.BASE_URL}/twilio/gather`;
      const twiml = createGatherResponseTwiML(
        "I didn't hear anything. How can I help you?",
        gatherUrl
      );
      
      res.type('text/xml');
      return res.send(twiml);
    }

    // Build call context
    const context = await callService.buildCallContext(CallSid);

    if (!context) {
      console.error(`Context not found for call ${CallSid}`);
      const twiml = createEndCallTwiML('Sorry, we are experiencing issues. Please call back. Goodbye.');
      res.type('text/xml');
      return res.send(twiml);
    }

    // Process user input through state machine
    const aiResponse = await stateMachine.processInput(context, SpeechResult);

    // Save conversation turn
    await callService.saveTranscript(context.sessionId, context.conversationHistory);

    // Update call state
    await callService.updateCallState(CallSid, aiResponse.nextState);

    // Log event
    await callService.logCallEvent({
      callSessionId: context.sessionId,
      eventType: 'user_input',
      state: context.state,
      data: JSON.stringify({ input: SpeechResult, confidence: Confidence }),
    });

    await callService.logCallEvent({
      callSessionId: context.sessionId,
      eventType: 'ai_response',
      state: aiResponse.nextState,
      data: JSON.stringify({ message: aiResponse.message }),
    });

    // Handle actions
    if (aiResponse.action) {
      switch (aiResponse.action.type) {
        case 'transfer':
          return await handleTransferAction(req, res, context, aiResponse.message);
        
        case 'end_call':
          const endTwiml = createEndCallTwiML(aiResponse.message);
          
          // Update call status
          await callService.updateCallStatus(CallSid, 'COMPLETED', new Date());
          
          // Schedule jobs
          await JobProcessor.createJob({
            type: 'summarize_call',
            payload: { callSessionId: context.sessionId },
          });
          
          res.type('text/xml');
          return res.send(endTwiml);
        
        case 'capture_lead':
          // Lead capture is handled in state machine
          break;
      }
    }

    // Continue conversation
    if (aiResponse.shouldGather) {
      const gatherUrl = `${env.BASE_URL}/twilio/gather`;
      const twiml = createGatherResponseTwiML(aiResponse.message, gatherUrl);
      
      res.type('text/xml');
      return res.send(twiml);
    } else {
      // Just say and end
      const twiml = createEndCallTwiML(aiResponse.message);
      res.type('text/xml');
      return res.send(twiml);
    }
  } catch (error) {
    console.error('Gather handler error:', error);
    res.type('text/xml');
    res.send('<Response><Say>Sorry, we encountered an error. Goodbye.</Say><Hangup/></Response>');
  }
}

/**
 * Handle transfer action
 */
async function handleTransferAction(
  req: Request,
  res: Response,
  context: any,
  message: string
) {
  try {
    // Get transfer target
    const transferNumber = await attemptTransfer(context.tenantId);

    if (!transferNumber) {
      // No transfer target available
      const gatherUrl = `${env.BASE_URL}/twilio/gather`;
      const twiml = createGatherResponseTwiML(
        "I'm sorry, no one is available right now. May I take your information for a callback?",
        gatherUrl
      );
      
      await callService.updateCallState(context.callSid, 'LEAD_CAPTURE');
      
      res.type('text/xml');
      return res.send(twiml);
    }

    // Mark transfer attempt
    await callService.markTransferAttempt(context.callSid, false);

    // Create transfer TwiML
    const statusCallbackUrl = `${env.BASE_URL}/twilio/transfer-status`;
    const twiml = createTransferTwiML(message, transferNumber, statusCallbackUrl);

    res.type('text/xml');
    res.send(twiml);
  } catch (error) {
    console.error('Transfer action error:', error);
    const gatherUrl = `${env.BASE_URL}/twilio/gather`;
    const twiml = createGatherResponseTwiML(
      "I'm having trouble transferring your call. May I take your information instead?",
      gatherUrl
    );
    
    res.type('text/xml');
    res.send(twiml);
  }
}

/**
 * Handle transfer status callback
 */
export async function handleTransferStatus(req: Request, res: Response) {
  try {
    const { CallSid, DialCallStatus } = req.body;

    console.log(`📞 Transfer status for ${CallSid}: ${DialCallStatus}`);

    const success = DialCallStatus === 'completed';
    
    await callService.markTransferAttempt(CallSid, success);

    if (success) {
      // Transfer successful - end call
      await callService.updateCallStatus(CallSid, 'COMPLETED', new Date());
      
      const twiml = createEndCallTwiML('');
      res.type('text/xml');
      return res.send(twiml);
    } else {
      // Transfer failed - capture lead
      const gatherUrl = `${env.BASE_URL}/twilio/gather`;
      const twiml = createGatherResponseTwiML(
        "I couldn't connect you. May I take your name and phone number so someone can call you back?",
        gatherUrl
      );
      
      await callService.updateCallState(CallSid, 'LEAD_CAPTURE');
      
      res.type('text/xml');
      return res.send(twiml);
    }
  } catch (error) {
    console.error('Transfer status error:', error);
    res.type('text/xml');
    res.send('<Response><Hangup/></Response>');
  }
}

/**
 * Handle call status callback
 */
export async function handleCallStatus(req: Request, res: Response) {
  try {
    const { CallSid, CallStatus, CallDuration } = req.body;

    console.log(`📞 Call status for ${CallSid}: ${CallStatus}`);

    if (CallStatus === 'completed') {
      const duration = parseInt(CallDuration || '0');
      await callService.updateCallStatus(CallSid, 'COMPLETED', new Date(), duration);
      
      // Get call session
      const session = await callService.getCallSessionByCallSid(CallSid);
      
      if (session) {
        // Schedule summary job
        await JobProcessor.createJob({
          type: 'summarize_call',
          payload: { callSessionId: session.id },
        });

        // If lead was captured, schedule notification
        if (session.leadCaptured) {
          const lead = await prisma.lead.findUnique({
            where: { callSessionId: session.id },
          });

          if (lead) {
            await JobProcessor.createJob({
              type: 'lead_notification',
              payload: { 
                tenantId: session.tenantId,
                leadId: lead.id,
              },
            });
          }
        }
      }
    }

    res.sendStatus(200);
  } catch (error) {
    console.error('Call status error:', error);
    res.sendStatus(500);
  }
}

/**
 * Handle recording status callback
 */
export async function handleRecordingStatus(req: Request, res: Response) {
  try {
    const { CallSid, RecordingSid, RecordingUrl, RecordingDuration } = req.body;

    console.log(`🎙️ Recording for ${CallSid}: ${RecordingSid}`);

    if (RecordingSid && RecordingUrl) {
      const session = await callService.getCallSessionByCallSid(CallSid);

      if (session) {
        await callService.saveRecording({
          callSessionId: session.id,
          recordingSid: RecordingSid,
          url: RecordingUrl,
          duration: parseInt(RecordingDuration || '0'),
        });
      }
    }

    res.sendStatus(200);
  } catch (error) {
    console.error('Recording status error:', error);
    res.sendStatus(500);
  }
}
