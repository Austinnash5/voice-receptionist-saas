import { Request, Response } from 'express';
import prisma from '../db/prisma';
import { callService } from '../services/call/callService';
import { flowExecutor } from '../services/call/flowExecutor';
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

    const tenantId = twilioNumber.tenantId;
    
    // Create call session
    const session = await callService.createCallSession({
      tenantId,
      twilioNumberId: twilioNumber.id,
      callSid: CallSid,
      fromNumber: From,
      toNumber: To,
      direction: Direction || 'inbound',
    });

    console.log(`✅ Created call session: ${session.id}`);

    // Determine which flow to use
    const flowType = await flowExecutor.determineFlowType(tenantId, {
      isInitialCall: true,
    });

    console.log(`📋 Using flow type: ${flowType}`);

    // Get the flow
    const flow = await flowExecutor.getActiveFlow(tenantId, flowType);

    if (flow) {
      // Store current flow and step in session metadata
      await prisma.callSession.update({
        where: { id: session.id },
        data: {
          metadata: {
            flowType,
            currentStepId: flow.entryPoint,
          },
        },
      });

      // Execute the entry point step
      const twiml = await flowExecutor.executeStep(flow, flow.entryPoint, tenantId, CallSid);
      res.type('text/xml');
      return res.send(twiml);
    }

    // No flow configured - fall back to simple AI greeting
    const config = twilioNumber.tenant.receptionistConfig;
    const greetingMessage = config?.greetingMessage || 
      'Thank you for calling. This call may be recorded. How can I help you today?';

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
 * Handle IVR menu digit selection
 */
export async function handleIVR(req: Request, res: Response) {
  try {
    const { CallSid, Digits, To } = req.body;

    console.log(`🔢 IVR selection for ${CallSid}: Digit ${Digits}`);

    // Find tenant and IVR configuration
    const twilioNumber = await prisma.twilioNumber.findUnique({
      where: { phoneNumber: To },
      include: {
        tenant: {
          include: {
            receptionistConfig: {
              include: {
                ivrMenuOptions: true,
              },
            },
          },
        },
      },
    });

    if (!twilioNumber || !twilioNumber.tenant || !twilioNumber.tenant.receptionistConfig) {
      res.type('text/xml');
      return res.send('<Response><Say>Configuration error.</Say><Hangup/></Response>');
    }

    const config = twilioNumber.tenant.receptionistConfig;
    const menuOption = config.ivrMenuOptions.find(opt => opt.digit === Digits);

    if (!menuOption) {
      // Invalid selection
      res.type('text/xml');
      return res.send('<Response><Say>Invalid selection. Goodbye.</Say><Hangup/></Response>');
    }

    // Update session metadata with IVR selection
    const session = await callService.getCallSessionByCallSid(CallSid);
    if (session) {
      const currentMetadata = (session.metadata as any) || {};
      await prisma.callSession.update({
        where: { id: session.id },
        data: {
          metadata: {
            ...currentMetadata,
            ivrSelection: Digits,
            ivrLabel: menuOption.label,
          },
        },
      });
    }

    console.log(`✅ IVR selection: ${menuOption.label} (${menuOption.action})`);

    // Handle action
    let twiml = '<?xml version=\"1.0\" encoding=\"UTF-8\"?><Response>';

    if (menuOption.customMessage) {
      twiml += `<Say>${menuOption.customMessage}</Say>`;
    }

    switch (menuOption.action) {
      case 'TRANSFER':
        if (menuOption.transferNumber) {
          twiml += `<Dial timeout=\"30\" action=\"${env.BASE_URL}/twilio/transfer-status\" method=\"POST\">`;
          twiml += `<Number>${menuOption.transferNumber}</Number>`;
          twiml += '</Dial>';
          twiml += '<Say>The call could not be completed. Please try again later.</Say>';
        } else {
          twiml += '<Say>Transfer number not configured.</Say>';
        }
        break;

      case 'AI_MODE':
        // Continue to AI receptionist
        const greetingMessage = config.greetingMessage || 'How can I help you today?';
        const gatherUrl = `${env.BASE_URL}/twilio/gather`;
        twiml += `<Gather input=\"speech\" timeout=\"3\" speechTimeout=\"auto\" action=\"${gatherUrl}\" method=\"POST\">`;
        twiml += `<Say>${greetingMessage}</Say>`;
        twiml += '</Gather>';
        twiml += '<Say>I did not hear anything. Goodbye.</Say>';
        break;

      case 'VOICEMAIL':
        const voicemailPrompt = config.voicemailPrompt || 
          'Please leave a message after the beep, and we will get back to you soon.';
        twiml += `<Say>${voicemailPrompt}</Say>`;
        twiml += '<Record maxLength=\"120\" transcribe=\"true\" playBeep=\"true\"/>';
        twiml += '<Say>Thank you for your message. Goodbye.</Say>';
        break;

      case 'CUSTOM_MESSAGE':
        // Message already played, just hang up
        break;

      case 'DEPARTMENT':
        // For now, route to AI with department context
        twiml += `<Gather input=\"speech\" timeout=\"3\" speechTimeout=\"auto\" action=\"${env.BASE_URL}/twilio/gather\" method=\"POST\">`;
        twiml += `<Say>Connecting you to ${menuOption.label}. How can we help you?</Say>`;
        twiml += '</Gather>';
        break;

      default:
        twiml += '<Say>Invalid action.</Say>';
    }

    twiml += '<Hangup/></Response>';

    res.type('text/xml');
    res.send(twiml);
  } catch (error) {
    console.error('IVR handler error:', error);
    res.type('text/xml');
    res.send('<Response><Say>An error occurred. Please try again later.</Say><Hangup/></Response>');
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

/**
 * Handle flow menu digit gather
 */
export async function handleFlowGather(req: Request, res: Response) {
  try {
    const { CallSid, Digits } = req.body;

    console.log(`🔢 Flow gather for ${CallSid}: Digit ${Digits}`);

    // Get call session to find current flow and step
    const session = await callService.getCallSessionByCallSid(CallSid);

    if (!session || !session.metadata) {
      res.type('text/xml');
      return res.send('<Response><Say>Session error.</Say><Hangup/></Response>');
    }

    const metadata = session.metadata as any;
    const flowType = metadata.flowType;
    const currentStepId = metadata.currentStepId;

    if (!flowType || !currentStepId) {
      res.type('text/xml');
      return res.send('<Response><Say>Flow configuration error.</Say><Hangup/></Response>');
    }

    // Get the flow
    const flow = await flowExecutor.getActiveFlow(session.tenantId, flowType);

    if (!flow) {
      res.type('text/xml');
      return res.send('<Response><Say>Flow not found.</Say><Hangup/></Response>');
    }

    // Handle the menu selection
    const selection = await flowExecutor.handleMenuSelection(flow, currentStepId, Digits);

    if (!selection) {
      // Invalid selection
      res.type('text/xml');
      return res.send('<Response><Say>Invalid selection. Please try again.</Say><Hangup/></Response>');
    }

    // Update session with selection
    await prisma.callSession.update({
      where: { id: session.id },
      data: {
        metadata: {
          ...metadata,
          lastSelection: Digits,
          currentStepId: selection.target,
        },
      },
    });

    // Execute the action
    let twiml: string;

    switch (selection.action) {
      case 'goto':
        if (selection.target) {
          // Update current step and execute it
          await prisma.callSession.update({
            where: { id: session.id },
            data: {
              metadata: {
                ...metadata,
                currentStepId: selection.target,
              },
            },
          });
          twiml = await flowExecutor.executeStep(flow, selection.target, session.tenantId, CallSid);
        } else {
          twiml = '<Response><Say>Target step not found.</Say><Hangup/></Response>';
        }
        break;

      case 'transfer':
        if (selection.phoneNumber) {
          twiml = '<?xml version="1.0" encoding="UTF-8"?><Response>';
          twiml += '<Say>Transferring your call now. Please hold.</Say>';
          twiml += `<Dial timeout="30" action="${env.BASE_URL}/twilio/transfer-status" method="POST">`;
          twiml += `<Number>${selection.phoneNumber}</Number>`;
          twiml += '</Dial>';
          twiml += '<Say>The call could not be completed.</Say>';
          twiml += '<Hangup/></Response>';
        } else {
          twiml = '<Response><Say>Transfer number not configured.</Say><Hangup/></Response>';
        }
        break;

      case 'ai':
        twiml = '<?xml version="1.0" encoding="UTF-8"?><Response>';
        twiml += `<Gather input="speech" timeout="3" speechTimeout="auto" action="${env.BASE_URL}/twilio/gather" method="POST">`;
        twiml += '<Say>How can I help you today?</Say>';
        twiml += '</Gather>';
        twiml += '<Say>I did not hear anything. Goodbye.</Say>';
        twiml += '<Hangup/></Response>';
        break;

      case 'voicemail':
        twiml = '<?xml version="1.0" encoding="UTF-8"?><Response>';
        twiml += '<Say>Please leave a message after the beep.</Say>';
        twiml += `<Record maxLength="120" transcribe="true" playBeep="true" transcribeCallback="${env.BASE_URL}/twilio/transcription"/>`;
        twiml += '<Say>Thank you for your message. Goodbye.</Say>';
        twiml += '<Hangup/></Response>';
        break;

      case 'hangup':
        twiml = '<Response><Say>Thank you for calling. Goodbye.</Say><Hangup/></Response>';
        break;

      default:
        twiml = '<Response><Say>Invalid action.</Say><Hangup/></Response>';
    }

    res.type('text/xml');
    res.send(twiml);
  } catch (error) {
    console.error('Flow gather error:', error);
    res.type('text/xml');
    res.send('<Response><Say>An error occurred. Goodbye.</Say><Hangup/></Response>');
  }
}

/**
 * Handle direct flow step execution (for redirects)
 */
export async function handleFlowStep(req: Request, res: Response) {
  try {
    const { stepId } = req.params;
    const { CallSid } = req.body;

    console.log(`📋 Executing flow step ${stepId} for ${CallSid}`);

    const session = await callService.getCallSessionByCallSid(CallSid);

    if (!session || !session.metadata) {
      res.type('text/xml');
      return res.send('<Response><Say>Session error.</Say><Hangup/></Response>');
    }

    const metadata = session.metadata as any;
    const flowType = metadata.flowType;

    if (!flowType) {
      res.type('text/xml');
      return res.send('<Response><Say>Flow type not found.</Say><Hangup/></Response>');
    }

    const flow = await flowExecutor.getActiveFlow(session.tenantId, flowType);

    if (!flow) {
      res.type('text/xml');
      return res.send('<Response><Say>Flow not found.</Say><Hangup/></Response>');
    }

    // Update current step
    await prisma.callSession.update({
      where: { id: session.id },
      data: {
        metadata: {
          ...metadata,
          currentStepId: stepId,
        },
      },
    });

    // Execute the step
    const twiml = await flowExecutor.executeStep(flow, stepId, session.tenantId, CallSid);

    res.type('text/xml');
    res.send(twiml);
  } catch (error) {
    console.error('Flow step execution error:', error);
    res.type('text/xml');
    res.send('<Response><Say>An error occurred. Goodbye.</Say><Hangup/></Response>');
  }
}
