import prisma from '../../db/prisma';
import { JobStatus } from '@prisma/client';
import { emailService } from './emailService';
import { openAIService } from '../ai/aiService';
import { callService } from '../call/callService';
import { 
  JobPayload, 
  EmailJobPayload, 
  CallSummaryJobPayload,
  LeadNotificationJobPayload 
} from '../../types';

export class JobProcessor {
  private isRunning = false;
  private pollInterval = 5000; // 5 seconds

  /**
   * Start the job processor
   */
  start() {
    if (this.isRunning) {
      console.log('⚠️  Job processor already running');
      return;
    }

    this.isRunning = true;
    console.log('✅ Job processor started');
    this.processLoop();
  }

  /**
   * Stop the job processor
   */
  stop() {
    this.isRunning = false;
    console.log('🛑 Job processor stopped');
  }

  /**
   * Main processing loop
   */
  private async processLoop() {
    while (this.isRunning) {
      try {
        await this.processPendingJobs();
      } catch (error) {
        console.error('Job processor error:', error);
      }

      // Wait before next poll
      await this.sleep(this.pollInterval);
    }
  }

  /**
   * Process pending jobs
   */
  private async processPendingJobs() {
    const now = new Date();

    // Get pending jobs that are ready to process
    const jobs = await prisma.job.findMany({
      where: {
        status: 'PENDING',
        attempts: {
          lt: prisma.job.fields.maxAttempts,
        },
        OR: [
          { scheduledAt: null },
          { scheduledAt: { lte: now } },
        ],
      },
      take: 10,
      orderBy: {
        createdAt: 'asc',
      },
    });

    if (jobs.length === 0) {
      return;
    }

    console.log(`📋 Processing ${jobs.length} jobs...`);

    for (const job of jobs) {
      await this.processJob(job.id, job.type, job.payload);
    }
  }

  /**
   * Process a single job
   */
  private async processJob(jobId: string, type: string, payloadJson: string) {
    try {
      // Mark as processing
      await prisma.job.update({
        where: { id: jobId },
        data: {
          status: 'PROCESSING',
          attempts: { increment: 1 },
        },
      });

      const payload: JobPayload = JSON.parse(payloadJson);

      let success = false;

      switch (type) {
        case 'send_email':
          success = await this.handleEmailJob(payload as EmailJobPayload);
          break;

        case 'summarize_call':
          success = await this.handleCallSummaryJob(payload as CallSummaryJobPayload);
          break;

        case 'lead_notification':
          success = await this.handleLeadNotificationJob(payload as LeadNotificationJobPayload);
          break;

        default:
          console.error(`Unknown job type: ${type}`);
          success = false;
      }

      if (success) {
        // Mark as completed
        await prisma.job.update({
          where: { id: jobId },
          data: {
            status: 'COMPLETED',
            processedAt: new Date(),
          },
        });
        console.log(`✅ Job ${jobId} (${type}) completed`);
      } else {
        throw new Error('Job execution failed');
      }
    } catch (error: any) {
      console.error(`❌ Job ${jobId} failed:`, error);

      // Check if max attempts reached
      const job = await prisma.job.findUnique({ where: { id: jobId } });
      
      if (job && job.attempts >= job.maxAttempts) {
        await prisma.job.update({
          where: { id: jobId },
          data: {
            status: 'FAILED',
            error: error.message || 'Unknown error',
          },
        });
      } else {
        // Reset to pending for retry
        await prisma.job.update({
          where: { id: jobId },
          data: {
            status: 'PENDING',
            error: error.message || 'Unknown error',
          },
        });
      }
    }
  }

  /**
   * Handle email job
   */
  private async handleEmailJob(payload: EmailJobPayload): Promise<boolean> {
    return await emailService.sendEmail(payload);
  }

  /**
   * Handle call summary job
   */
  private async handleCallSummaryJob(payload: CallSummaryJobPayload): Promise<boolean> {
    try {
      const callSession = await prisma.callSession.findUnique({
        where: { id: payload.callSessionId },
        include: {
          transcript: true,
          tenant: {
            include: {
              users: {
                where: {
                  role: 'TENANT_ADMIN',
                },
              },
            },
          },
        },
      });

      if (!callSession || !callSession.transcript) {
        console.log('No transcript found for call');
        return true; // Mark as complete to avoid retrying
      }

      // Generate summary using AI
      const analysis = await openAIService.summarizeCall(
        callSession.transcript.fullText
      );

      // Save summary
      await callService.saveCallSummary({
        callSessionId: callSession.id,
        intent: analysis.intent,
        summary: analysis.summary,
        sentiment: analysis.sentiment,
        actionItems: analysis.actionItems,
      });

      // Send email to tenant admin
      if (callSession.tenant.users.length > 0) {
        const adminEmail = callSession.tenant.users[0].email;
        
        await emailService.sendCallSummary({
          tenantEmail: adminEmail,
          callerNumber: callSession.fromNumber,
          callDuration: callSession.duration || 0,
          summary: analysis.summary,
          intent: analysis.intent,
          callTime: callSession.startTime,
        });
      }

      return true;
    } catch (error) {
      console.error('Call summary job error:', error);
      return false;
    }
  }

  /**
   * Handle lead notification job
   */
  private async handleLeadNotificationJob(payload: LeadNotificationJobPayload): Promise<boolean> {
    try {
      const lead = await prisma.lead.findUnique({
        where: { id: payload.leadId },
        include: {
          tenant: {
            include: {
              users: {
                where: {
                  role: 'TENANT_ADMIN',
                },
              },
            },
          },
          callSession: true,
        },
      });

      if (!lead) {
        console.log('Lead not found');
        return true;
      }

      // Send notification to tenant admin
      if (lead.tenant.users.length > 0) {
        const adminEmail = lead.tenant.users[0].email;

        await emailService.sendLeadNotification({
          tenantName: lead.tenant.name,
          tenantEmail: adminEmail,
          leadName: lead.name || 'Unknown',
          leadPhone: lead.phone || 'Not provided',
          leadEmail: lead.email || 'Not provided',
          leadReason: lead.reason || 'Not specified',
          callTime: lead.callSession?.startTime || lead.createdAt,
        });
      }

      return true;
    } catch (error) {
      console.error('Lead notification job error:', error);
      return false;
    }
  }

  /**
   * Create a new job
   */
  static async createJob(params: {
    type: string;
    payload: JobPayload;
    scheduledAt?: Date;
    maxAttempts?: number;
  }) {
    try {
      const job = await prisma.job.create({
        data: {
          type: params.type,
          payload: JSON.stringify(params.payload),
          status: 'PENDING',
          scheduledAt: params.scheduledAt,
          maxAttempts: params.maxAttempts || 3,
        },
      });

      return job;
    } catch (error) {
      console.error('Error creating job:', error);
      throw error;
    }
  }

  /**
   * Sleep utility
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

export const jobProcessor = new JobProcessor();
