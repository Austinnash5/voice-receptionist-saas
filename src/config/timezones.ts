const FALLBACK_TIMEZONES = [
  'UTC',
  'Pacific/Midway',
  'Pacific/Honolulu',
  'America/Anchorage',
  'America/Los_Angeles',
  'America/Denver',
  'America/Chicago',
  'America/New_York',
  'America/Sao_Paulo',
  'Europe/London',
  'Europe/Paris',
  'Europe/Berlin',
  'Africa/Johannesburg',
  'Asia/Dubai',
  'Asia/Kolkata',
  'Asia/Shanghai',
  'Asia/Tokyo',
  'Australia/Sydney'
];

/**
 * Returns a canonical list of IANA timezones supported by the current runtime.
 * Falls back to a curated subset if full data is unavailable.
 */
export function getAllTimezones(): string[] {
  try {
    const supported = (Intl as any)?.supportedValuesOf?.('timeZone');
    if (Array.isArray(supported) && supported.length > 0) {
      return supported;
    }
  } catch (error) {
    // Ignore runtime errors and use fallback list
  }

  return FALLBACK_TIMEZONES;
}
