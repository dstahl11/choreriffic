import type { CalendarSource, PrismaClient } from "@prisma/client";
import { calendarCache } from "@/lib/calendar/cache";
import { fetchGoogleCalendar } from "@/lib/calendar/google";
import { fetchIcsCalendar } from "@/lib/calendar/ics";
import { compareCalendarEvents, normalizeCalendarEvents } from "@/lib/calendar/normalize";
import type { CalendarQueryRange } from "@/lib/calendar/types";
import type { KioskCalendarPayload } from "@/types/kiosk";

const GOOGLE_TTL_MS = 5 * 60_000;
const ICS_TTL_MS = 15 * 60_000;

async function fetchSource(source: CalendarSource, range: CalendarQueryRange) {
  const providerEvents = source.kind === "google"
    ? await fetchGoogleCalendar(source, range)
    : await fetchIcsCalendar(source, range);
  return normalizeCalendarEvents(source, providerEvents, range);
}

async function sourceResult(prisma: PrismaClient, source: CalendarSource, range: CalendarQueryRange) {
  const result = await calendarCache.get(
    source.id,
    `${range.from}:${range.to}`,
    source.kind === "google" ? GOOGLE_TTL_MS : ICS_TTL_MS,
    () => fetchSource(source, range),
  );
  let lastSyncedAt = source.lastSyncedAt;
  if (result.fetched) {
    if (result.error) {
      await prisma.calendarSource.update({
        where: { id: source.id },
        data: { lastError: result.error },
      });
    } else {
      lastSyncedAt = new Date(result.fetchedAt ?? Date.now());
      await prisma.calendarSource.update({
        where: { id: source.id },
        data: { lastSyncedAt, lastError: null },
      });
    }
  }
  return {
    events: result.events,
    summary: {
      id: source.id,
      name: source.name,
      color: source.color,
      stale: result.stale,
      lastSyncedAt: lastSyncedAt?.toISOString() ?? null,
    },
    error: result.error,
  };
}

export async function getCalendarEvents(
  prisma: PrismaClient,
  range: CalendarQueryRange,
): Promise<KioskCalendarPayload> {
  const sources = await prisma.calendarSource.findMany({
    where: { enabled: true },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
  });
  const settled = await Promise.allSettled(
    sources.map((source) => sourceResult(prisma, source, range)),
  );
  const results = settled.map((result, index) => result.status === "fulfilled"
    ? result.value
    : {
        events: [],
        summary: {
          id: sources[index].id,
          name: sources[index].name,
          color: sources[index].color,
          stale: true,
          lastSyncedAt: sources[index].lastSyncedAt?.toISOString() ?? null,
        },
        error: result.reason instanceof Error ? result.reason.message : "Calendar sync failed.",
      });
  return {
    range,
    events: results.flatMap((result) => result.events).sort(compareCalendarEvents),
    sources: results.map((result) => result.summary),
  };
}

export async function syncCalendarSource(
  prisma: PrismaClient,
  sourceId: string,
  range: CalendarQueryRange,
) {
  const source = await prisma.calendarSource.findUniqueOrThrow({ where: { id: sourceId } });
  calendarCache.clearSource(source.id);
  return sourceResult(prisma, source, range);
}

export function clearCalendarSourceCache(sourceId: string) {
  calendarCache.clearSource(sourceId);
}
