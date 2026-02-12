import nodemailer from 'nodemailer';
import { env } from '../../config/env';
import { EmailJobPayload } from '../../types';

class EmailService {
  private transporter: nodemailer.Transporter;

  constructor() {
    this.transporter = nodemailer.createTransport({
      host: env.EMAIL_HOST,
      port: parseInt(env.EMAIL_PORT),
      secure: env.EMAIL_PORT === '465',
      auth: {
        user: env.EMAIL_USER,
        pass: env.EMAIL_PASSWORD,
      },
    });
  }

  /**
   * Send email
   */
  async sendEmail(payload: EmailJobPayload): Promise<boolean> {
    try {
      await this.transporter.sendMail({
        from: env.EMAIL_FROM,
        to: payload.to,
        subject: payload.subject,
        text: payload.text,
        html: payload.html,
      });

      console.log(`✅ Email sent to ${payload.to}`);
      return true;
    } catch (error) {
      console.error('Email send error:', error);
      return false;
    }
  }

  /**
   * Send new lead notification
   */
  async sendLeadNotification(params: {
    tenantName: string;
    tenantEmail: string;
    leadName: string;
    leadPhone: string;
    leadEmail: string;
    leadReason: string;
    callTime: Date;
  }): Promise<boolean> {
    const html = `
      <h2>New Lead Captured</h2>
      <p>A new lead was captured from a phone call:</p>
      <ul>
        <li><strong>Name:</strong> ${params.leadName}</li>
        <li><strong>Phone:</strong> ${params.leadPhone}</li>
        <li><strong>Email:</strong> ${params.leadEmail}</li>
        <li><strong>Reason:</strong> ${params.leadReason}</li>
        <li><strong>Call Time:</strong> ${params.callTime.toLocaleString()}</li>
      </ul>
      <p>Please follow up with this lead as soon as possible.</p>
    `;

    const text = `
New Lead Captured

Name: ${params.leadName}
Phone: ${params.leadPhone}
Email: ${params.leadEmail}
Reason: ${params.leadReason}
Call Time: ${params.callTime.toLocaleString()}

Please follow up with this lead as soon as possible.
    `;

    return this.sendEmail({
      to: params.tenantEmail,
      subject: `New Lead: ${params.leadName}`,
      text,
      html,
    });
  }

  /**
   * Send call summary notification
   */
  async sendCallSummary(params: {
    tenantEmail: string;
    callerNumber: string;
    callDuration: number;
    summary: string;
    intent: string;
    callTime: Date;
  }): Promise<boolean> {
    const html = `
      <h2>Call Summary</h2>
      <p>Summary of recent call:</p>
      <ul>
        <li><strong>Caller:</strong> ${params.callerNumber}</li>
        <li><strong>Time:</strong> ${params.callTime.toLocaleString()}</li>
        <li><strong>Duration:</strong> ${Math.round(params.callDuration / 60)} minutes</li>
        <li><strong>Intent:</strong> ${params.intent}</li>
      </ul>
      <h3>Summary:</h3>
      <p>${params.summary}</p>
    `;

    const text = `
Call Summary

Caller: ${params.callerNumber}
Time: ${params.callTime.toLocaleString()}
Duration: ${Math.round(params.callDuration / 60)} minutes
Intent: ${params.intent}

Summary:
${params.summary}
    `;

    return this.sendEmail({
      to: params.tenantEmail,
      subject: `Call Summary from ${params.callerNumber}`,
      text,
      html,
    });
  }

  /**
   * Verify email configuration
   */
  async verifyConnection(): Promise<boolean> {
    try {
      await this.transporter.verify();
      console.log('✅ Email service ready');
      return true;
    } catch (error) {
      console.error('❌ Email service error:', error);
      return false;
    }
  }
}

export const emailService = new EmailService();
