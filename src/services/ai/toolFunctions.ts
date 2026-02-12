import prisma from '../../db/prisma';
import { LeadData } from '../../types';

/**
 * Check if business is currently open
 */
export async function getBusinessHoursStatus(tenantId: string): Promise<{
  isOpen: boolean;
  hours: string;
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

    if (!businessHour || !businessHour.isOpen) {
      return {
        isOpen: false,
        hours: 'Closed today',
      };
    }

    // Check if current time is within open hours
    const currentTime = now.toTimeString().slice(0, 5); // HH:MM
    const isOpen = currentTime >= businessHour.openTime && currentTime < businessHour.closeTime;

    return {
      isOpen,
      hours: `${businessHour.openTime} to ${businessHour.closeTime}`,
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

    // Simple keyword matching
    for (const entry of entries) {
      const keywords = entry.keywords.map((k: string) => k.toLowerCase());
      const questionWords = entry.question.toLowerCase().split(' ');

      const hasMatch = keywords.some((keyword: string) => lowerQuery.includes(keyword)) ||
        questionWords.some((word: string) => word.length > 3 && lowerQuery.includes(word));

      if (hasMatch) {
        return {
          found: true,
          answer: entry.answer,
          category: entry.category,
        };
      }
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
