import prisma from '../../db/prisma';
import { CallState, CallStatus } from '@prisma/client';
import { CallContext, ConversationTurn } from '../../types';

export class CallService {
  /**
   * Create a new call session
   */
  async createCallSession(params: {
    tenantId: string;
    twilioNumberId: string;
    callSid: string;
    fromNumber: string;
    toNumber: string;
    direction?: string;
  }) {
    try {
      const session = await prisma.callSession.create({
        data: {
          tenantId: params.tenantId,
          twilioNumberId: params.twilioNumberId,
          callSid: params.callSid,
          fromNumber: params.fromNumber,
          toNumber: params.toNumber,
          direction: params.direction || 'inbound',
          status: 'IN_PROGRESS',
          state: 'GREETING',
          startTime: new Date(),
        },
      });

      return session;
    } catch (error) {
      console.error('Error creating call session:', error);
      throw error;
    }
  }

  /**
   * Get call session by call SID
   */
  async getCallSessionByCallSid(callSid: string) {
    try {
      return await prisma.callSession.findUnique({
        where: { callSid },
        include: {
          tenant: true,
          twilioNumber: true,
        },
      });
    } catch (error) {
      console.error('Error fetching call session:', error);
      return null;
    }
  }

  /**
   * Update call session state
   */
  async updateCallState(callSid: string, state: CallState) {
    try {
      const session = await prisma.callSession.update({
        where: { callSid },
        data: { state },
      });

      // Log event
      await this.logCallEvent({
        callSessionId: session.id,
        eventType: 'state_change',
        state,
        data: JSON.stringify({ newState: state }),
      });

      return session;
    } catch (error) {
      console.error('Error updating call state:', error);
      throw error;
    }
  }

  /**
   * Update call session status
   */
  async updateCallStatus(callSid: string, status: CallStatus, endTime?: Date, duration?: number) {
    try {
      return await prisma.callSession.update({
        where: { callSid },
        data: {
          status,
          ...(endTime && { endTime }),
          ...(duration && { duration }),
        },
      });
    } catch (error) {
      console.error('Error updating call status:', error);
      throw error;
    }
  }

  /**
   * Mark transfer attempt
   */
  async markTransferAttempt(callSid: string, success: boolean) {
    try {
      return await prisma.callSession.update({
        where: { callSid },
        data: {
          transferAttempted: true,
          transferSuccess: success,
        },
      });
    } catch (error) {
      console.error('Error marking transfer:', error);
      throw error;
    }
  }

  /**
   * Log call event
   */
  async logCallEvent(params: {
    callSessionId: string;
    eventType: string;
    state?: CallState;
    data: string;
  }) {
    try {
      return await prisma.callEvent.create({
        data: {
          callSessionId: params.callSessionId,
          eventType: params.eventType,
          state: params.state,
          data: params.data,
          timestamp: new Date(),
        },
      });
    } catch (error) {
      console.error('Error logging call event:', error);
    }
  }

  /**
   * Save call transcript
   */
  async saveTranscript(callSessionId: string, turns: ConversationTurn[]) {
    try {
      const fullText = turns
        .map(t => `${t.speaker.toUpperCase()}: ${t.text}`)
        .join('\n');

      const turnsJson = JSON.stringify(turns);

      const transcript = await prisma.transcript.upsert({
        where: { callSessionId },
        update: {
          fullText,
          turns: turnsJson,
        },
        create: {
          callSessionId,
          fullText,
          turns: turnsJson,
        },
      });

      return transcript;
    } catch (error) {
      console.error('Error saving transcript:', error);
      throw error;
    }
  }

  /**
   * Save call summary
   */
  async saveCallSummary(params: {
    callSessionId: string;
    intent: string;
    summary: string;
    sentiment?: string;
    actionItems?: string[];
  }) {
    try {
      return await prisma.callSummary.upsert({
        where: { callSessionId: params.callSessionId },
        update: {
          intent: params.intent,
          summary: params.summary,
          sentiment: params.sentiment,
          actionItems: params.actionItems || [],
        },
        create: {
          callSessionId: params.callSessionId,
          intent: params.intent,
          summary: params.summary,
          sentiment: params.sentiment,
          actionItems: params.actionItems || [],
        },
      });
    } catch (error) {
      console.error('Error saving call summary:', error);
      throw error;
    }
  }

  /**
   * Save recording info
   */
  async saveRecording(params: {
    callSessionId: string;
    recordingSid: string;
    url: string;
    duration?: number;
  }) {
    try {
      const recording = await prisma.recording.create({
        data: {
          callSessionId: params.callSessionId,
          recordingSid: params.recordingSid,
          url: params.url,
          duration: params.duration,
        },
      });

      // Update call session with recording info
      await prisma.callSession.update({
        where: { id: params.callSessionId },
        data: {
          recordingUrl: params.url,
          recordingSid: params.recordingSid,
        },
      });

      return recording;
    } catch (error) {
      console.error('Error saving recording:', error);
      throw error;
    }
  }

  /**
   * Build call context from session
   */
  async buildCallContext(callSid: string): Promise<CallContext | null> {
    try {
      const session = await prisma.callSession.findUnique({
        where: { callSid },
        include: {
          events: {
            orderBy: { timestamp: 'asc' },
          },
          transcript: true,
        },
      });

      if (!session) {
        return null;
      }

      // Rebuild conversation history from transcript
      let conversationHistory: ConversationTurn[] = [];
      
      if (session.transcript) {
        try {
          conversationHistory = JSON.parse(session.transcript.turns);
        } catch (e) {
          conversationHistory = [];
        }
      }

      return {
        callSid: session.callSid,
        tenantId: session.tenantId,
        sessionId: session.id,
        fromNumber: session.fromNumber,
        toNumber: session.toNumber,
        state: session.state,
        conversationHistory,
        metadata: {
          transferAttempts: session.transferAttempted ? 1 : 0,
          silentCount: 0,
          turnCount: conversationHistory.length,
        },
      };
    } catch (error) {
      console.error('Error building call context:', error);
      return null;
    }
  }
}

export const callService = new CallService();
