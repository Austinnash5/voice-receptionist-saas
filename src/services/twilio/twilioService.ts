import twilio from 'twilio';
import { env } from '../../config/env';

class TwilioService {
  private client: twilio.Twilio;

  constructor() {
    this.client = twilio(env.TWILIO_ACCOUNT_SID, env.TWILIO_AUTH_TOKEN);
  }

  /**
   * Get Twilio client instance
   */
  getClient(): twilio.Twilio {
    return this.client;
  }

  /**
   * Validate webhook request signature
   */
  validateRequest(
    authToken: string,
    signature: string,
    url: string,
    params: { [key: string]: string }
  ): boolean {
    return twilio.validateRequest(authToken, signature, url, params);
  }

  /**
   * Make an outbound call
   */
  async makeCall(params: {
    to: string;
    from: string;
    url: string;
    statusCallback?: string;
  }) {
    try {
      const call = await this.client.calls.create({
        to: params.to,
        from: params.from,
        url: params.url,
        statusCallback: params.statusCallback,
      });

      return call;
    } catch (error) {
      console.error('Twilio call error:', error);
      throw error;
    }
  }

  /**
   * Send SMS
   */
  async sendSMS(params: { to: string; from: string; body: string }) {
    try {
      const message = await this.client.messages.create({
        to: params.to,
        from: params.from,
        body: params.body,
      });

      return message;
    } catch (error) {
      console.error('Twilio SMS error:', error);
      throw error;
    }
  }

  /**
   * Get call details
   */
  async getCall(callSid: string) {
    try {
      const call = await this.client.calls(callSid).fetch();
      return call;
    } catch (error) {
      console.error('Error fetching call:', error);
      throw error;
    }
  }

  /**
   * Get recording
   */
  async getRecording(recordingSid: string) {
    try {
      const recording = await this.client.recordings(recordingSid).fetch();
      return recording;
    } catch (error) {
      console.error('Error fetching recording:', error);
      throw error;
    }
  }

  /**
   * List recordings for a call
   */
  async getCallRecordings(callSid: string) {
    try {
      const recordings = await this.client.recordings.list({ callSid });
      return recordings;
    } catch (error) {
      console.error('Error fetching recordings:', error);
      return [];
    }
  }
}

export const twilioService = new TwilioService();
