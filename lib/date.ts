import { addDays, differenceInCalendarDays, format, isMatch, parse } from "date-fns";

export const APP_TIME_ZONE = "America/New_York";
export const CALENDAR_DATE_FORMAT = "yyyy-MM-dd";

export function parseCalendarDate(value: string): Date {
  if (!isMatch(value, CALENDAR_DATE_FORMAT)) {
    throw new Error(`Invalid calendar date: ${value}. Expected YYYY-MM-DD.`);
  }

  const parsed = parse(value, CALENDAR_DATE_FORMAT, new Date(0));
  return new Date(
    Date.UTC(parsed.getFullYear(), parsed.getMonth(), parsed.getDate()),
  );
}

export function normalizeCalendarDate(value: Date): Date {
  return new Date(
    Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()),
  );
}

export function formatCalendarDate(value: Date): string {
  const normalized = normalizeCalendarDate(value);
  const localMirror = new Date(
    normalized.getUTCFullYear(),
    normalized.getUTCMonth(),
    normalized.getUTCDate(),
  );
  return format(localMirror, CALENDAR_DATE_FORMAT);
}

export function todayInAppTimeZone(now = new Date()): Date {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: APP_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return parseCalendarDate(`${values.year}-${values.month}-${values.day}`);
}

export function addCalendarDays(value: Date, amount: number): Date {
  const normalized = normalizeCalendarDate(value);
  const localMirror = new Date(
    normalized.getUTCFullYear(),
    normalized.getUTCMonth(),
    normalized.getUTCDate(),
  );
  return parseCalendarDate(format(addDays(localMirror, amount), CALENDAR_DATE_FORMAT));
}

export function calendarDaySpan(from: Date, to: Date): number {
  const fromMirror = new Date(
    from.getUTCFullYear(),
    from.getUTCMonth(),
    from.getUTCDate(),
  );
  const toMirror = new Date(to.getUTCFullYear(), to.getUTCMonth(), to.getUTCDate());
  return differenceInCalendarDays(toMirror, fromMirror);
}
