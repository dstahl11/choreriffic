import { addCalendarDays, formatCalendarDate, parseCalendarDate } from "@/lib/date";
import { APP_TIME_ZONE } from "@/lib/date";
import type { KioskCalendarEvent } from "@/types/kiosk";
import type {
  CalendarQueryRange,
  CalendarSourceConfig,
  ProviderCalendarEvent,
} from "@/lib/calendar/types";

function zonedParts(value: Date) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: APP_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(value);
  return Object.fromEntries(parts.map((part) => [part.type, part.value]));
}

export function calendarDateInAppTimeZone(value: Date) {
  const parts = zonedParts(value);
  return `${parts.year}-${parts.month}-${parts.day}`;
}

export function appTimeZoneOffsetMinutes(value: Date) {
  const parts = zonedParts(value);
  const representedAsUtc = Date.UTC(
    Number(parts.year), Number(parts.month) - 1, Number(parts.day),
    Number(parts.hour), Number(parts.minute), Number(parts.second),
  );
  return Math.round((representedAsUtc - value.getTime()) / 60_000);
}

export function isoInAppTimeZone(value: Date) {
  const parts = zonedParts(value);
  const offset = appTimeZoneOffsetMinutes(value);
  const sign = offset >= 0 ? "+" : "-";
  const absolute = Math.abs(offset);
  const offsetText = `${sign}${String(Math.floor(absolute / 60)).padStart(2, "0")}:${String(absolute % 60).padStart(2, "0")}`;
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}:${parts.second}${offsetText}`;
}

export function dateFromAppTimeZoneParts(parts: {
  year: number; month: number; day: number; hour?: number; minute?: number; second?: number;
}) {
  const utcGuess = Date.UTC(
    parts.year, parts.month - 1, parts.day,
    parts.hour ?? 0, parts.minute ?? 0, parts.second ?? 0,
  );
  let result = utcGuess - appTimeZoneOffsetMinutes(new Date(utcGuess)) * 60_000;
  result = utcGuess - appTimeZoneOffsetMinutes(new Date(result)) * 60_000;
  return new Date(result);
}

function enumerateDates(from: string, to: string) {
  const dates: string[] = [];
  let cursor = parseCalendarDate(from);
  const end = parseCalendarDate(to);
  while (cursor <= end) {
    dates.push(formatCalendarDate(cursor));
    cursor = addCalendarDays(cursor, 1);
  }
  return dates;
}

function eventDays(event: ProviderCalendarEvent, range: CalendarQueryRange) {
  if (event.allDay) {
    const eventStart = event.start as string;
    const eventEndExclusive = event.end as string;
    return enumerateDates(range.from, range.to).filter(
      (date) => date >= eventStart && date < eventEndExclusive,
    );
  }

  const start = event.start as Date;
  const end = event.end as Date;
  if (end <= start) return [];
  const first = calendarDateInAppTimeZone(start);
  const last = calendarDateInAppTimeZone(new Date(end.getTime() - 1));
  return enumerateDates(range.from, range.to).filter(
    (date) => date >= first && date <= last,
  );
}

export function normalizeCalendarEvent(
  source: CalendarSourceConfig,
  event: ProviderCalendarEvent,
  range: CalendarQueryRange,
): KioskCalendarEvent | null {
  const days = eventDays(event, range);
  if (!days.length) return null;
  const start = event.allDay ? String(event.start) : isoInAppTimeZone(event.start as Date);
  const end = event.allDay ? String(event.end) : isoInAppTimeZone(event.end as Date);
  return {
    id: `${source.id}:${event.providerEventId}:${start}`,
    sourceId: source.id,
    sourceName: source.name,
    color: event.color ?? source.color,
    title: event.title.trim() || "(No title)",
    location: source.showLocation ? event.location?.trim() || null : null,
    allDay: event.allDay,
    start,
    end,
    days,
  };
}

export function normalizeCalendarEvents(
  source: CalendarSourceConfig,
  events: ProviderCalendarEvent[],
  range: CalendarQueryRange,
) {
  return events
    .map((event) => normalizeCalendarEvent(source, event, range))
    .filter((event): event is KioskCalendarEvent => event !== null)
    .sort(compareCalendarEvents);
}

export function compareCalendarEvents(left: KioskCalendarEvent, right: KioskCalendarEvent) {
  const date = (left.days[0] ?? left.start).localeCompare(right.days[0] ?? right.start);
  if (date) return date;
  if (left.allDay !== right.allDay) return left.allDay ? -1 : 1;
  const start = left.start.localeCompare(right.start);
  return start || left.title.localeCompare(right.title);
}
