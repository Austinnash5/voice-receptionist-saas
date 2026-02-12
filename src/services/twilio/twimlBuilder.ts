import twilio from 'twilio';
import { TwiMLGatherConfig } from '../../types';

const VoiceResponse = twilio.twiml.VoiceResponse;

export class TwiMLBuilder {
  private twiml: typeof VoiceResponse.prototype;

  constructor() {
    this.twiml = new VoiceResponse();
  }

  /**
   * Add a Say element
   */
  say(text: string, options?: { voice?: string; language?: string }): this {
    this.twiml.say(
      {
        voice: (options?.voice as any) || 'Polly.Joanna',
        language: (options?.language as any) || 'en-US',
      },
      text
    );
    return this;
  }

  /**
   * Add a Gather element for speech input
   */
  gather(config: Partial<TwiMLGatherConfig>, nestedSay?: string): this {
    const gather = this.twiml.gather({
      input: (config.input as any) || 'speech',
      action: config.action || '',
      method: config.method || 'POST',
      timeout: config.timeout || 3,
      speechTimeout: config.speechTimeout || 'auto',
      language: (config.language as any) || 'en-US',
      hints: config.hints,
    });

    if (nestedSay) {
      gather.say({ voice: 'Polly.Joanna' }, nestedSay);
    }

    return this;
  }

  /**
   * Add a Dial element
   */
  dial(number: string, options?: { 
    timeout?: number; 
    action?: string;
    method?: string;
  }): this {
    this.twiml.dial(
      {
        timeout: options?.timeout || 30,
        action: options?.action,
        method: options?.method || 'POST',
      },
      number
    );
    return this;
  }

  /**
   * Add a Play element
   */
  play(url: string): this {
    this.twiml.play(url);
    return this;
  }

  /**
   * Add a Pause element
   */
  pause(length?: number): this {
    this.twiml.pause({ length: length || 1 });
    return this;
  }

  /**
   * Add a Record element
   */
  record(options?: {
    maxLength?: number;
    transcribe?: boolean;
    action?: string;
  }): this {
    this.twiml.record({
      maxLength: options?.maxLength || 30,
      transcribe: options?.transcribe || false,
      action: options?.action,
    });
    return this;
  }

  /**
   * Add a Redirect element
   */
  redirect(url: string, method?: 'GET' | 'POST'): this {
    this.twiml.redirect({ method: method || 'POST' }, url);
    return this;
  }

  /**
   * Add a Hangup element
   */
  hangup(): this {
    this.twiml.hangup();
    return this;
  }

  /**
   * Add a Reject element
   */
  reject(reason?: 'rejected' | 'busy'): this {
    this.twiml.reject({ reason: reason || 'rejected' });
    return this;
  }

  /**
   * Build the TwiML XML string
   */
  build(): string {
    return this.twiml.toString();
  }
}

/**
 * Helper functions for common TwiML patterns
 */

export function createGreetingTwiML(
  message: string,
  gatherUrl: string
): string {
  const builder = new TwiMLBuilder();
  
  return builder
    .gather(
      {
        action: gatherUrl,
        method: 'POST',
        input: 'speech',
        speechTimeout: 'auto',
        timeout: 3,
      },
      message
    )
    .say("I didn't hear anything. Let me try again.")
    .redirect(gatherUrl)
    .build();
}

export function createTransferTwiML(
  message: string,
  phoneNumber: string,
  statusCallbackUrl: string
): string {
  const builder = new TwiMLBuilder();
  
  return builder
    .say(message)
    .pause(1)
    .dial(phoneNumber, {
      timeout: 30,
      action: statusCallbackUrl,
      method: 'POST',
    })
    .say("I'm sorry, we couldn't connect you. Let me take your information for a callback.")
    .redirect(statusCallbackUrl)
    .build();
}

export function createEndCallTwiML(message: string): string {
  const builder = new TwiMLBuilder();
  
  return builder
    .say(message)
    .pause(1)
    .hangup()
    .build();
}

export function createGatherResponseTwiML(
  message: string,
  gatherUrl: string
): string {
  const builder = new TwiMLBuilder();
  
  return builder
    .gather(
      {
        action: gatherUrl,
        method: 'POST',
        input: 'speech',
        speechTimeout: 'auto',
        timeout: 3,
      },
      message
    )
    .say("I didn't catch that.")
    .redirect(gatherUrl)
    .build();
}
