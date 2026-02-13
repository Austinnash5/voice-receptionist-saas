import prisma from '../../db/prisma';

export interface BusinessHourUpdate {
  dayOfWeek: number;
  isOpen: boolean;
  openTime: string;
  closeTime: string;
}

export interface HolidayInput {
  name: string;
  date: Date;
  isClosed: boolean;
  openTime?: string | null;
  closeTime?: string | null;
}

const DEFAULT_TIMEZONE = 'America/Los_Angeles';
const CLOSED_TIME_FALLBACK = '00:00';

/**
 * Persist weekly business hours for a tenant.
 */
export async function saveBusinessHoursForTenant(
  tenantId: string,
  hours: BusinessHourUpdate[],
  timezone?: string
): Promise<void> {
  const tz = (timezone || '').trim() || DEFAULT_TIMEZONE;

  const ops = hours.map(hour => {
    if (hour.isOpen) {
      if (!hour.openTime || !hour.closeTime) {
        throw new Error('Open and close times are required for open days.');
      }
      if (hour.openTime >= hour.closeTime) {
        throw new Error('Open time must be before close time.');
      }
    }

    const openTime = hour.isOpen ? hour.openTime : CLOSED_TIME_FALLBACK;
    const closeTime = hour.isOpen ? hour.closeTime : CLOSED_TIME_FALLBACK;

    return prisma.businessHours.upsert({
      where: {
        tenantId_dayOfWeek: {
          tenantId,
          dayOfWeek: hour.dayOfWeek,
        },
      },
      update: {
        isOpen: hour.isOpen,
        openTime,
        closeTime,
        timezone: tz,
      },
      create: {
        tenantId,
        dayOfWeek: hour.dayOfWeek,
        isOpen: hour.isOpen,
        openTime,
        closeTime,
        timezone: tz,
      },
    });
  });

  await prisma.$transaction(ops);
}

/**
 * Add a holiday override for a tenant.
 */
export async function addHolidayForTenant(
  tenantId: string,
  data: HolidayInput
) {
  return prisma.holidayHours.create({
    data: {
      tenantId,
      name: data.name,
      date: data.date,
      isClosed: data.isClosed,
      openTime: data.isClosed ? null : data.openTime || null,
      closeTime: data.isClosed ? null : data.closeTime || null,
    },
  });
}

/**
 * Delete an existing holiday override, scoped to tenant.
 */
export async function deleteHolidayForTenant(
  tenantId: string,
  holidayId: string
): Promise<void> {
  await prisma.holidayHours.deleteMany({
    where: {
      id: holidayId,
      tenantId,
    },
  });
}
