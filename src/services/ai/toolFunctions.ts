import prisma from '../../db/prisma';
import { LeadData } from '../../types';

/**
 * Check if business is currently open and get complete schedule
 */
export async function getBusinessHoursStatus(tenantId: string): Promise<{
  isOpen: boolean;
  hours: string;
  fullSchedule?: string;
}> {
  try {
    const now = new Date();
    const dayOfWeek = now.getDay(); // 0 = Sunday

    // Check for holiday closure
    const holiday = await prisma.holidayHours.findFirst({
      where: {
        tenantId,
        date: {
          gte: new Date(now.setHours(0, 0, 0, 0)),
          lt: new Date(now.setHours(23, 59, 59, 999)),
        },
      },
    });

    if (holiday) {
      if (holiday.isClosed) {
        return {
          isOpen: false,
          hours: `Closed for ${holiday.name}`,
        };
      }
    }

    // Check regular business hours
    const businessHour = await prisma.businessHours.findUnique({
      where: {
        tenantId_dayOfWeek: {
          tenantId,
          dayOfWeek,
        },
      },
    });

    // Get full week schedule
    const allHours = await prisma.businessHours.findMany({
      where: { tenantId },
      orderBy: { dayOfWeek: 'asc' },
    });

    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const schedule = allHours
      .map(h => {
        const dayName = dayNames[h.dayOfWeek];
        if (!h.isOpen) return `${dayName}: Closed`;
        return `${dayName}: ${h.openTime} to ${h.closeTime}`;
      })
      .join(', ');

    if (!businessHour || !businessHour.isOpen) {
      return {
        isOpen: false,
        hours: 'Closed today',
        fullSchedule: schedule || undefined,
      };
    }

    // Check if current time is within open hours
    const currentTime = now.toTimeString().slice(0, 5); // HH:MM
    const isOpen = currentTime >= businessHour.openTime && currentTime < businessHour.closeTime;

    return {
      isOpen,
      hours: `${businessHour.openTime} to ${businessHour.closeTime}`,
      fullSchedule: schedule || undefined,
    };
  } catch (error) {
    console.error('Error checking business hours:', error);
    return {
      isOpen: false,
      hours: 'Unknown',
    };
  }
}

/**
 * Search FAQs for quick answers
 */
export async function searchFAQs(
  tenantId: string,
  query: string
): Promise<{
  found: boolean;
  question: string;
  answer: string;
  category?: string;
}> {
  try {
    const lowerQuery = query.toLowerCase();

    // Get active FAQs ordered by order field
    const faqs = await prisma.fAQ.findMany({
      where: {
        tenantId,
        isActive: true,
      },
      orderBy: [
        { category: 'asc' },
        { order: 'asc' },
      ],
    });

    // Search through FAQs for matching keywords
    for (const faq of faqs) {
      const questionLower = faq.question.toLowerCase();
      const answerLower = faq.answer.toLowerCase();
      
      // Split query into words for better matching
      const queryWords = lowerQuery.split(' ').filter(w => w.length > 3);
      
      // Check if any query words match the question
      const hasMatch = queryWords.some(word => 
        questionLower.includes(word) || answerLower.includes(word)
      );

      if (hasMatch) {
        return {
          found: true,
          question: faq.question,
          answer: faq.answer,
          category: faq.category || undefined,
        };
      }
    }

    return {
      found: false,
      question: '',
      answer: '',
    };
  } catch (error) {
    console.error('Error searching FAQs:', error);
    return {
      found: false,
      question: '',
      answer: '',
    };
  }
}

/**
 * Search knowledge base for answer
 */
export async function lookupKnowledgeBase(
  tenantId: string,
  query: string
): Promise<{
  found: boolean;
  answer: string;
  category?: string;
}> {
  try {
    const lowerQuery = query.toLowerCase();

    // Search by keywords
    const entries = await prisma.knowledgeBaseEntry.findMany({
      where: {
        tenantId,
        isActive: true,
      },
      orderBy: {
        priority: 'desc',
      },
    });

    // Simple keyword matching with scoring
    let bestMatch: any = null;
    let bestScore = 0;

    for (const entry of entries) {
      const keywords = entry.keywords.map((k: string) => k.toLowerCase());
      const questionWords = entry.question.toLowerCase().split(' ');
      let score = 0;

      // Score based on keyword matches
      keywords.forEach((keyword: string) => {
        if (lowerQuery.includes(keyword)) {
          score += 3; // Keywords are most important
        }
      });

      // Score based on question word matches
      questionWords.forEach((word: string) => {
        if (word.length > 3 && lowerQuery.includes(word)) {
          score += 1;
        }
      });

      if (score > bestScore) {
        bestScore = score;
        bestMatch = entry;
      }
    }

    if (bestMatch && bestScore > 0) {
      return {
        found: true,
        answer: bestMatch.answer,
        category: bestMatch.category,
      };
    }

    return {
      found: false,
      answer: '',
    };
  } catch (error) {
    console.error('Error searching knowledge base:', error);
    return {
      found: false,
      answer: '',
    };
  }
}

/**
 * Get transfer targets for a tenant
 */
export async function getTransferTargets(
  tenantId: string,
  departmentId?: string
): Promise<Array<{ name: string; phoneNumber: string; priority: number }>> {
  try {
    const targets = await prisma.transferTarget.findMany({
      where: {
        tenantId,
        isActive: true,
        ...(departmentId && { departmentId }),
      },
      orderBy: {
        priority: 'asc',
      },
    });

    return targets.map((t: any) => ({
      name: t.name,
      phoneNumber: t.phoneNumber,
      priority: t.priority,
    }));
  } catch (error) {
    console.error('Error fetching transfer targets:', error);
    return [];
  }
}

/**
 * Create a lead record
 */
export async function createLeadRecord(
  tenantId: string,
  callSessionId: string,
  leadData: Partial<LeadData>
): Promise<string | null> {
  try {
    const lead = await prisma.lead.create({
      data: {
        tenantId,
        callSessionId,
        name: leadData.name,
        phone: leadData.phone,
        email: leadData.email,
        reason: leadData.reason,
        callbackPreference: leadData.callbackPreference || 'phone',
        status: 'NEW',
        source: 'voice_call',
      },
    });

    // Update call session
    await prisma.callSession.update({
      where: { id: callSessionId },
      data: { leadCaptured: true },
    });

    return lead.id;
  } catch (error) {
    console.error('Error creating lead:', error);
    return null;
  }
}

/**
 * Attempt to transfer call (returns phone number to dial)
 */
export async function attemptTransfer(
  tenantId: string,
  reason?: string
): Promise<string | null> {
  try {
    const targets = await getTransferTargets(tenantId);

    if (targets.length === 0) {
      return null;
    }

    // Return first available target
    return targets[0].phoneNumber;
  } catch (error) {
    console.error('Error attempting transfer:', error);
    return null;
  }
}

/**
 * Get knowledge statistics for a tenant
 */
export async function getKnowledgeStats(tenantId: string): Promise<{
  faqCount: number;
  knowledgeBaseCount: number;
  callFlowCount: number;
}> {
  try {
    const [faqCount, knowledgeBaseCount, callFlowCount] = await Promise.all([
      prisma.fAQ.count({ where: { tenantId, isActive: true } }),
      prisma.knowledgeBaseEntry.count({ where: { tenantId, isActive: true } }),
      prisma.callFlow.count({ where: { tenantId, isActive: true } }),
    ]);

    return {
      faqCount,
      knowledgeBaseCount,
      callFlowCount,
    };
  } catch (error) {
    console.error('Error fetching knowledge stats:', error);
    return {
      faqCount: 0,
      knowledgeBaseCount: 0,
      callFlowCount: 0,
    };
  }
}
