import { CallState, CallStatus, UserRole } from '@prisma/client';

// ============================================
// AI SERVICE TYPES
// ============================================

export interface CallContext {
  callSid: string;
  tenantId: string;
  sessionId: string;
  fromNumber: string;
  toNumber: string;
  state: CallState;
  conversationHistory: ConversationTurn[];
  metadata: {
    transferAttempts?: number;
    silentCount?: number;
    turnCount?: number;
    capturedData?: Partial<LeadData>;
  };
}

export interface ConversationTurn {
  speaker: 'user' | 'ai';
  text: string;
  timestamp: Date;
  state?: CallState;
}

export interface LeadData {
  name: string;
  phone: string;
  email: string;
  reason: string;
  callbackPreference: string;
}

export interface AIResponse {
  message: string;
  nextState: CallState;
  action?: {
    type: 'transfer' | 'capture_lead' | 'end_call';
    data?: any;
  };
  shouldGather: boolean;
}

export interface ToolFunction {
  name: string;
  description: string;
  parameters: any;
}

// ============================================
// TWILIO TYPES
// ============================================

export interface TwilioWebhookParams {
  CallSid: string;
  From: string;
  To: string;
  CallStatus?: string;
  Direction?: string;
  SpeechResult?: string;
  Confidence?: string;
  [key: string]: string | undefined;
}

export interface TwiMLGatherConfig {
  input: 'speech' | 'dtmf' | 'speech dtmf';
  action: string;
  method: 'GET' | 'POST';
  timeout?: number;
  speechTimeout?: string;
  language?: string;
  hints?: string;
}

// ============================================
// JOB TYPES
// ============================================

export interface JobPayload {
  [key: string]: any;
}

export interface EmailJobPayload extends JobPayload {
  to: string;
  subject: string;
  text?: string;
  html?: string;
}

export interface CallSummaryJobPayload extends JobPayload {
  callSessionId: string;
}

export interface LeadNotificationJobPayload extends JobPayload {
  tenantId: string;
  leadId: string;
}

// ============================================
// API TYPES
// ============================================

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface PaginatedResponse<T> extends ApiResponse<T[]> {
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

// ============================================
// DASHBOARD TYPES
// ============================================

export interface DashboardStats {
  totalCalls: number;
  answeredCalls: number;
  transferredCalls: number;
  leadsGenerated: number;
  avgCallDuration: number;
  period: string;
}

export interface CallListItem {
  id: string;
  callSid: string;
  fromNumber: string;
  startTime: Date;
  duration: number | null;
  status: CallStatus;
  state: CallState;
  leadCaptured: boolean;
  transferSuccess: boolean;
}

export interface LeadListItem {
  id: string;
  name: string | null;
  phone: string | null;
  email: string | null;
  reason: string | null;
  status: string;
  createdAt: Date;
}

// ============================================
// EXPRESS EXTENSIONS
// ============================================

declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        email: string;
        role: UserRole;
        tenantId: string | null;
      };
      tenant?: {
        id: string;
        name: string;
        slug: string;
      };
    }
  }
}

export {};
