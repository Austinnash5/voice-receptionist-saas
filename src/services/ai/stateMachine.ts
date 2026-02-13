import { CallState } from '@prisma/client';
import { CallContext, AIResponse, ConversationTurn } from '../../types';
import { openAIService } from './aiService';
import { 
  getBusinessHoursStatus, 
  lookupKnowledgeBase, 
  createLeadRecord,
  getTransferTargets 
} from './toolFunctions';

export class StateMachine {
  /**
   * Process user input and determine next state and response
   */
  async processInput(
    context: CallContext,
    userInput: string
  ): Promise<AIResponse> {
    // Add user input to conversation history
    const turn: ConversationTurn = {
      speaker: 'user',
      text: userInput,
      timestamp: new Date(),
      state: context.state,
    };
    
    context.conversationHistory.push(turn);
    context.metadata.turnCount = (context.metadata.turnCount || 0) + 1;

    // Process based on current state
    switch (context.state) {
      case 'GREETING':
        return this.handleGreeting(context, userInput);
      
      case 'INTENT':
        return this.handleIntent(context, userInput);
      
      case 'FAQ':
        return this.handleFAQ(context, userInput);
      
      case 'TRANSFER_ATTEMPT':
        return this.handleTransfer(context, userInput);
      
      case 'LEAD_CAPTURE':
        return this.handleLeadCapture(context, userInput);
      
      case 'CONFIRMATION':
        return this.handleConfirmation(context, userInput);
      
      case 'WRAP_UP':
        return this.handleWrapUp(context, userInput);
      
      default:
        return this.handleUnknown(context, userInput);
    }
  }

  /**
   * Handle initial greeting state
   */
  private async handleGreeting(
    context: CallContext,
    userInput: string
  ): Promise<AIResponse> {
    // After greeting, identify intent
    return {
      message: "I'd be happy to help. What can I assist you with today?",
      nextState: 'INTENT',
      shouldGather: true,
    };
  }

  /**
   * Handle intent identification
   */
  private async handleIntent(
    context: CallContext,
    userInput: string
  ): Promise<AIResponse> {
    // Use AI to classify intent
    const intent = await this.classifyIntent(context, userInput);

    // Check if business hours matter
    const hoursStatus = await getBusinessHoursStatus(context.tenantId);

    // Check if user wants to speak to someone
    const wantsHuman = this.detectTransferRequest(userInput);

    if (wantsHuman) {
      if (hoursStatus.isOpen) {
        return {
          message: "Of course. Let me connect you with someone who can help. Please hold.",
          nextState: 'TRANSFER_ATTEMPT',
          action: {
            type: 'transfer',
            data: { reason: intent },
          },
          shouldGather: false,
        };
      } else {
        return {
          message: `We're currently closed. Our hours are ${hoursStatus.hours}. I'd be happy to take your information and have someone call you back. What's your name?`,
          nextState: 'LEAD_CAPTURE',
          shouldGather: true,
        };
      }
    }

    // Try to answer with knowledge base
    const kbResult = await lookupKnowledgeBase(context.tenantId, userInput);

    if (kbResult.found) {
      return {
        message: `${kbResult.answer}\n\nIs there anything else I can help you with?`,
        nextState: 'FAQ',
        shouldGather: true,
      };
    }

    // Can't answer - offer transfer or lead capture
    if (hoursStatus.isOpen) {
      return {
        message: "I don't have that specific information right now. Would you like me to connect you with someone who can help?",
        nextState: 'FAQ',
        shouldGather: true,
      };
    } else {
      return {
        message: `I don't have that information and we're currently closed. May I take your contact information so someone can get back to you?`,
        nextState: 'LEAD_CAPTURE',
        shouldGather: true,
      };
    }
  }

  /**
   * Handle FAQ/conversation state
   */
  private async handleFAQ(
    context: CallContext,
    userInput: string
  ): Promise<AIResponse> {
    // Check if user wants transfer
    if (this.detectTransferRequest(userInput)) {
      const hoursStatus = await getBusinessHoursStatus(context.tenantId);
      
      if (hoursStatus.isOpen) {
        return {
          message: "Certainly. Let me connect you now. Please hold.",
          nextState: 'TRANSFER_ATTEMPT',
          action: { type: 'transfer' },
          shouldGather: false,
        };
      } else {
        return {
          message: `We're currently closed. May I take your information for a callback? What's your name?`,
          nextState: 'LEAD_CAPTURE',
          shouldGather: true,
        };
      }
    }

    // Check if user is done
    if (this.detectEndRequest(userInput)) {
      return {
        message: "Great! Is there anything else I can help you with before we go?",
        nextState: 'WRAP_UP',
        shouldGather: true,
      };
    }

    // Try to answer their question
    const kbResult = await lookupKnowledgeBase(context.tenantId, userInput);

    if (kbResult.found) {
      return {
        message: `${kbResult.answer}\n\nAnything else I can help with?`,
        nextState: 'FAQ',
        shouldGather: true,
      };
    }

    // Can't answer - use AI
    const aiResponse = await openAIService.chat(context, userInput);
    
    return {
      message: aiResponse.message,
      nextState: 'FAQ',
      shouldGather: true,
    };
  }

  /**
   * Handle transfer attempt state
   */
  private async handleTransfer(
    context: CallContext,
    userInput: string
  ): Promise<AIResponse> {
    // This state is typically handled by Twilio Dial
    // If we reach here, transfer may have failed
    
    return {
      message: "I'm having trouble connecting you right now. Would you like to leave your contact information so someone can call you back?",
      nextState: 'LEAD_CAPTURE',
      shouldGather: true,
    };
  }

  /**
   * Handle lead capture state
   */
  private async handleLeadCapture(
    context: CallContext,
    userInput: string
  ): Promise<AIResponse> {
    const captured = context.metadata.capturedData || {};

    // Capture in sequence: name -> phone -> email -> reason
    if (!captured.name) {
      captured.name = this.extractName(userInput);
      context.metadata.capturedData = captured;
      return {
        message: `Thank you, ${captured.name}. What's the best phone number to reach you?`,
        nextState: 'LEAD_CAPTURE',
        shouldGather: true,
      };
    }

    if (!captured.phone) {
      captured.phone = this.extractPhone(userInput);
      context.metadata.capturedData = captured;
      return {
        message: "Great. And your email address?",
        nextState: 'LEAD_CAPTURE',
        shouldGather: true,
      };
    }

    if (!captured.email) {
      captured.email = this.extractEmail(userInput);
      context.metadata.capturedData = captured;
      return {
        message: "Perfect. Can you briefly tell me what this is regarding?",
        nextState: 'LEAD_CAPTURE',
        shouldGather: true,
      };
    }

    if (!captured.reason) {
      captured.reason = userInput;
      captured.callbackPreference = 'phone';
      context.metadata.capturedData = captured;

      // Save lead
      await createLeadRecord(context.tenantId, context.sessionId, captured);

      return {
        message: `Thank you, ${captured.name}. I've got all your information. Someone will get back to you as soon as possible. Have a great day!`,
        nextState: 'ENDED',
        action: { type: 'end_call' },
        shouldGather: false,
      };
    }

    // Shouldn't reach here
    return {
      message: "Thank you for your information. Someone will contact you soon.",
      nextState: 'ENDED',
      action: { type: 'end_call' },
      shouldGather: false,
    };
  }

  /**
   * Handle confirmation state
   */
  private async handleConfirmation(
    context: CallContext,
    userInput: string
  ): Promise<AIResponse> {
    const affirmative = /yes|yeah|sure|okay|correct|right/i.test(userInput);

    if (affirmative) {
      return {
        message: "Perfect! Is there anything else I can help with?",
        nextState: 'WRAP_UP',
        shouldGather: true,
      };
    }

    return {
      message: "I apologize. Let me help you with that. What do you need?",
      nextState: 'FAQ',
      shouldGather: true,
    };
  }

  /**
   * Handle wrap-up state
   */
  private async handleWrapUp(
    context: CallContext,
    userInput: string
  ): Promise<AIResponse> {
    const needsMoreHelp = /yes|yeah|actually/i.test(userInput);

    if (needsMoreHelp) {
      return {
        message: "Of course! What else can I help you with?",
        nextState: 'FAQ',
        shouldGather: true,
      };
    }

    return {
      message: "Thank you for calling. Have a wonderful day!",
      nextState: 'ENDED',
      action: { type: 'end_call' },
      shouldGather: false,
    };
  }

  /**
   * Handle unknown state
   */
  private async handleUnknown(
    context: CallContext,
    userInput: string
  ): Promise<AIResponse> {
    return {
      message: "I'm sorry, I didn't quite understand. How can I help you?",
      nextState: 'INTENT',
      shouldGather: true,
    };
  }

  /**
   * Classify user intent using simple pattern matching
   */
  private async classifyIntent(
    context: CallContext,
    userInput: string
  ): Promise<string> {
    const lower = userInput.toLowerCase();

    if (/sales|buy|purchase|pricing|price|cost/i.test(lower)) return 'sales';
    if (/service|appointment|schedule|book/i.test(lower)) return 'service';
    if (/support|help|issue|problem|broken/i.test(lower)) return 'support';
    if (/billing|invoice|payment|charge/i.test(lower)) return 'billing';
    if (/hours|open|closed|location|address/i.test(lower)) return 'info';

    return 'general';
  }

  /**
   * Detect if user wants to speak to a human
   */
  private detectTransferRequest(input: string): boolean {
    const patterns = [
      /speak (to|with) (a |someone|person|human|representative)/i,
      /talk (to|with) (a |someone|person|human)/i,
      /transfer me/i,
      /real person/i,
      /human/i,
      /representative/i,
      /agent/i,
      /connect me/i,
    ];

    return patterns.some(pattern => pattern.test(input));
  }

  /**
   * Detect if user wants to end call
   */
  private detectEndRequest(input: string): boolean {
    const patterns = [
      /no|nope|that's all|that's it|nothing else|i'm good|all set|goodbye|bye/i,
    ];

    return patterns.some(pattern => pattern.test(input));
  }

  /**
   * Extract name from input
   */
  private extractName(input: string): string {
    // Remove common prefixes
    let cleaned = input
      .replace(/my name is|i'm|i am|this is|it's|it is/gi, '')
      .replace(/\b(mr|mrs|ms|dr|miss)\.?\s/gi, '')
      .trim();
    
    // If it looks like a phone number, return "Customer"
    if (/^[\d\s\(\)\-\+]+$/.test(cleaned)) {
      return 'Customer';
    }
    
    // Take first few words as name
    const words = cleaned.split(/\s+/);
    const name = words.slice(0, 3).join(' ');
    
    return name || 'Customer';
  }

  /**
   * Extract phone from input
   */
  private extractPhone(input: string): string {
    // Remove any text that's clearly not a phone number
    const cleaned = input.replace(/my (phone |cell |number |)?(is|number is)?(\s+)?/gi, '');
    
    // Extract digits
    const digits = cleaned.replace(/\D/g, '');
    
    // Validate length
    if (digits.length === 10) {
      return `+1${digits}`;
    } else if (digits.length === 11 && digits.startsWith('1')) {
      return `+${digits}`;
    } else if (digits.length > 0) {
      // Store whatever digits we got
      return digits;
    }
    
    // If no digits found, check if they said it out (e.g., "five five five one two three four")
    const spoken = this.extractSpokenPhone(input);
    if (spoken) return spoken;
    
    return 'not provided';
  }

  /**
   * Extract phone number from spoken words (e.g., "five five five one two three four")
   */
  private extractSpokenPhone(input: string): string | null {
    const lowerInput = input.toLowerCase();
    const digitMap: { [key: string]: string } = {
      'zero': '0', 'oh': '0', 'one': '1', 'two': '2', 'to': '2', 'too': '2',
      'three': '3', 'four': '4', 'for': '4', 'five': '5', 'six': '6',
      'seven': '7', 'eight': '8', 'ate': '8', 'nine': '9',
    };

    let digits = '';
    const words = lowerInput.split(/\s+/);
    
    for (const word of words) {
      if (digitMap[word]) {
        digits += digitMap[word];
      }
    }

    if (digits.length === 10) {
      return `+1${digits}`;
    } else if (digits.length === 11 && digits.startsWith('1')) {
      return `+${digits}`;
    }

    return null;
  }

  /**
   * Extract email from input
   */
  private extractEmail(input: string): string {
    const emailRegex = /[\w.-]+@[\w.-]+\.\w+/;
    const match = input.match(emailRegex);
    return match ? match[0] : 'not provided';
  }
}

export const stateMachine = new StateMachine();
