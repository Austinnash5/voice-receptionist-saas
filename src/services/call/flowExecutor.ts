import prisma from '../../db/prisma';
import { env } from '../../config/env';
import { getBusinessHoursStatus } from '../ai/toolFunctions';

/**
 * Flow Step Types
 */
export type FlowStepType = 'menu' | 'message' | 'transfer' | 'ai' | 'voicemail' | 'gather_info' | 'conditional';

export interface FlowStep {
  id: string;
  type: FlowStepType;
  prompt?: string;
  options?: FlowOption[];
  timeout?: number;
  phoneNumber?: string;
  condition?: 'is_open' | 'is_closed';
  trueTarget?: string;
  falseTarget?: string;
  gatherType?: 'name' | 'phone' | 'email' | 'reason';
  nextStep?: string;
}

export interface FlowOption {
  digit: string;
  label: string;
  action: 'goto' | 'transfer' | 'ai' | 'voicemail' | 'hangup';
  target?: string;
  phoneNumber?: string;
}

export interface FlowConfig {
  steps: FlowStep[];
  entryPoint: string;
  description?: string;
}

/**
 * Flow Executor - Executes multi-step call flows
 */
export class FlowExecutor {
  /**
   * Get the appropriate flow for the current context
   */
  async getActiveFlow(tenantId: string, flowType: string): Promise<FlowConfig | null> {
    try {
      const flow = await prisma.callFlow.findFirst({
        where: {
          tenantId,
          flowType: flowType as any,
          isActive: true,
        },
        orderBy: { priority: 'desc' },
      });

      if (!flow) return null;

      return flow.config as unknown as FlowConfig;
    } catch (error) {
      console.error('Error fetching flow:', error);
      return null;
    }
  }

  /**
   * Determine which flow type to use based on context
   */
  async determineFlowType(tenantId: string, callContext: {
    isInitialCall?: boolean;
    isNoAnswer?: boolean;
    isAfterHours?: boolean;
  }): Promise<string> {
    // Check business hours for after-hours flow
    if (callContext.isAfterHours) {
      const hasAfterHoursFlow = await this.flowExists(tenantId, 'AFTER_HOURS');
      if (hasAfterHoursFlow) return 'AFTER_HOURS';
    }

    const hoursStatus = await getBusinessHoursStatus(tenantId);
    if (!hoursStatus.isOpen) {
      const hasAfterHoursFlow = await this.flowExists(tenantId, 'AFTER_HOURS');
      if (hasAfterHoursFlow) return 'AFTER_HOURS';
    }

    // Check for no answer flow
    if (callContext.isNoAnswer) {
      const hasNoAnswerFlow = await this.flowExists(tenantId, 'NO_ANSWER');
      if (hasNoAnswerFlow) return 'NO_ANSWER';
    }

    // Default to main menu
    return 'MAIN_MENU';
  }

  /**
   * Check if a flow exists for the tenant
   */
  private async flowExists(tenantId: string, flowType: string): Promise<boolean> {
    const count = await prisma.callFlow.count({
      where: {
        tenantId,
        flowType: flowType as any,
        isActive: true,
      },
    });
    return count > 0;
  }

  /**
   * Get a specific step from a flow
   */
  getStep(flow: FlowConfig, stepId: string): FlowStep | null {
    return flow.steps.find(s => s.id === stepId) || null;
  }

  /**
   * Execute a flow step and generate TwiML
   */
  async executeStep(
    flow: FlowConfig,
    stepId: string,
    tenantId: string,
    callSid: string
  ): Promise<string> {
    const step = this.getStep(flow, stepId);

    if (!step) {
      return this.generateErrorTwiML('Flow step not found.');
    }

    switch (step.type) {
      case 'menu':
        return this.generateMenuTwiML(step, callSid);

      case 'message':
        return this.generateMessageTwiML(step);

      case 'transfer':
        return this.generateTransferTwiML(step);

      case 'ai':
        return this.generateAITwiML(step);

      case 'voicemail':
        return this.generateVoicemailTwiML(step);

      case 'conditional':
        return await this.generateConditionalTwiML(step, tenantId, callSid);

      case 'gather_info':
        return this.generateGatherInfoTwiML(step, callSid);

      default:
        return this.generateErrorTwiML('Unknown step type.');
    }
  }

  /**
   * Generate TwiML for a menu step
   */
  private generateMenuTwiML(step: FlowStep, callSid: string): string {
    const timeout = step.timeout || 5;
    const gatherUrl = `${env.BASE_URL}/twilio/flow-gather`;

    let twiml = '<?xml version="1.0" encoding="UTF-8"?><Response>';
    twiml += `<Gather input="dtmf" timeout="${timeout}" numDigits="1" action="${gatherUrl}" method="POST">`;
    
    if (step.prompt) {
      twiml += `<Say>${this.escapeXML(step.prompt)}</Say>`;
    }

    // Read out menu options
    if (step.options && step.options.length > 0) {
      for (const option of step.options) {
        twiml += `<Say>Press ${option.digit} for ${this.escapeXML(option.label)}.</Say>`;
      }
    }

    twiml += '</Gather>';
    twiml += '<Say>I did not receive a selection. Goodbye.</Say>';
    twiml += '<Hangup/>';
    twiml += '</Response>';

    return twiml;
  }

  /**
   * Generate TwiML for a message step
   */
  private generateMessageTwiML(step: FlowStep): string {
    let twiml = '<?xml version="1.0" encoding="UTF-8"?><Response>';
    
    if (step.prompt) {
      twiml += `<Say>${this.escapeXML(step.prompt)}</Say>`;
    }

    if (step.nextStep) {
      // Redirect to next step
      twiml += `<Redirect method="POST">${env.BASE_URL}/twilio/flow-step/${step.nextStep}</Redirect>`;
    } else {
      twiml += '<Hangup/>';
    }

    twiml += '</Response>';
    return twiml;
  }

  /**
   * Generate TwiML for a transfer step
   */
  private generateTransferTwiML(step: FlowStep): string {
    let twiml = '<?xml version="1.0" encoding="UTF-8"?><Response>';
    
    if (step.prompt) {
      twiml += `<Say>${this.escapeXML(step.prompt)}</Say>`;
    }

    if (step.phoneNumber) {
      twiml += `<Dial timeout="30" action="${env.BASE_URL}/twilio/transfer-status" method="POST">`;
      twiml += `<Number>${step.phoneNumber}</Number>`;
      twiml += '</Dial>';
      twiml += '<Say>The call could not be completed. Please try again later.</Say>';
    } else {
      twiml += '<Say>Transfer number not configured.</Say>';
    }

    twiml += '<Hangup/></Response>';
    return twiml;
  }

  /**
   * Generate TwiML for AI receptionist mode
   */
  private generateAITwiML(step: FlowStep): string {
    const greeting = step.prompt || 'How can I help you today?';
    const gatherUrl = `${env.BASE_URL}/twilio/gather`;

    let twiml = '<?xml version="1.0" encoding="UTF-8"?><Response>';
    twiml += `<Gather input="speech" timeout="3" speechTimeout="auto" action="${gatherUrl}" method="POST">`;
    twiml += `<Say>${this.escapeXML(greeting)}</Say>`;
    twiml += '</Gather>';
    twiml += '<Say>I did not hear anything. Goodbye.</Say>';
    twiml += '<Hangup/></Response>';

    return twiml;
  }

  /**
   * Generate TwiML for voicemail
   */
  private generateVoicemailTwiML(step: FlowStep): string {
    const prompt = step.prompt || 'Please leave a message after the beep.';

    let twiml = '<?xml version="1.0" encoding="UTF-8"?><Response>';
    twiml += `<Say>${this.escapeXML(prompt)}</Say>`;
    twiml += '<Record maxLength="120" transcribe="true" playBeep="true" transcribeCallback="' + env.BASE_URL + '/twilio/transcription"/>';
    twiml += '<Say>Thank you for your message. Goodbye.</Say>';
    twiml += '<Hangup/></Response>';

    return twiml;
  }

  /**
   * Generate TwiML for conditional logic (e.g., check business hours)
   */
  private async generateConditionalTwiML(
    step: FlowStep,
    tenantId: string,
    callSid: string
  ): Promise<string> {
    let conditionMet = false;

    if (step.condition === 'is_open') {
      const hours = await getBusinessHoursStatus(tenantId);
      conditionMet = hours.isOpen;
    } else if (step.condition === 'is_closed') {
      const hours = await getBusinessHoursStatus(tenantId);
      conditionMet = !hours.isOpen;
    }

    const targetStep = conditionMet ? step.trueTarget : step.falseTarget;

    if (!targetStep) {
      return this.generateErrorTwiML('Conditional flow missing target.');
    }

    // Redirect to the appropriate step
    let twiml = '<?xml version="1.0" encoding="UTF-8"?><Response>';
    twiml += `<Redirect method="POST">${env.BASE_URL}/twilio/flow-step/${targetStep}?callSid=${callSid}</Redirect>`;
    twiml += '</Response>';

    return twiml;
  }

  /**
   * Generate TwiML for gathering information (lead capture)
   */
  private generateGatherInfoTwiML(step: FlowStep, callSid: string): string {
    const gatherUrl = `${env.BASE_URL}/twilio/flow-gather-info`;

    let twiml = '<?xml version="1.0" encoding="UTF-8"?><Response>';
    twiml += `<Gather input="speech" timeout="5" speechTimeout="auto" action="${gatherUrl}" method="POST">`;
    
    if (step.prompt) {
      twiml += `<Say>${this.escapeXML(step.prompt)}</Say>`;
    }

    twiml += '</Gather>';
    twiml += '<Say>I did not hear your response. Goodbye.</Say>';
    twiml += '<Hangup/></Response>';

    return twiml;
  }

  /**
   * Generate error TwiML
   */
  private generateErrorTwiML(message: string): string {
    return '<?xml version="1.0" encoding="UTF-8"?><Response>' +
      `<Say>${this.escapeXML(message)}</Say>` +
      '<Hangup/></Response>';
  }

  /**
   * Escape XML special characters
   */
  private escapeXML(text: string): string {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  }

  /**
   * Handle digit selection in a menu
   */
  async handleMenuSelection(
    flow: FlowConfig,
    currentStepId: string,
    digit: string
  ): Promise<{ action: string; target?: string; phoneNumber?: string } | null> {
    const step = this.getStep(flow, currentStepId);

    if (!step || step.type !== 'menu') {
      return null;
    }

    const option = step.options?.find(opt => opt.digit === digit);

    if (!option) {
      return null;
    }

    return {
      action: option.action,
      target: option.target,
      phoneNumber: option.phoneNumber,
    };
  }
}

export const flowExecutor = new FlowExecutor();
