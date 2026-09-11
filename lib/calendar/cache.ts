import type { KioskCalendarEvent } from "@/types/kiosk";

type CacheEntry = { fetchedAt: number; events: KioskCalendarEvent[] };
export type CachedFetchResult = {
  events: KioskCalendarEvent[];
  stale: boolean;
  fetched: boolean;
  error: string | null;
  fetchedAt: number | null;
};

export class CalendarCache {
  private entries = new Map<string, CacheEntry>();
  constructor(private readonly maxRangesPerSource = 8) {}

  clearSource(sourceId: string) {
    for (const key of this.entries.keys()) {
      if (key.startsWith(`${sourceId}:`)) this.entries.delete(key);
    }
  }

  sizeForSource(sourceId: string) {
    return [...this.entries.keys()].filter((key) => key.startsWith(`${sourceId}:`)).length;
  }

  async get(
    sourceId: string,
    rangeKey: string,
    ttlMs: number,
    fetcher: () => Promise<KioskCalendarEvent[]>,
    now = Date.now(),
  ): Promise<CachedFetchResult> {
    const key = `${sourceId}:${rangeKey}`;
    const existing = this.entries.get(key);
    if (existing && now - existing.fetchedAt < ttlMs) {
      this.entries.delete(key);
      this.entries.set(key, existing);
      return { events: existing.events, stale: false, fetched: false, error: null, fetchedAt: existing.fetchedAt };
    }
    try {
      const events = await fetcher();
      this.entries.delete(key);
      this.entries.set(key, { events, fetchedAt: now });
      const sourceKeys = [...this.entries.keys()].filter((candidate) => candidate.startsWith(`${sourceId}:`));
      while (sourceKeys.length > this.maxRangesPerSource) {
        const oldest = sourceKeys.shift();
        if (oldest) this.entries.delete(oldest);
      }
      return { events, stale: false, fetched: true, error: null, fetchedAt: now };
    } catch (error) {
      return {
        events: existing?.events ?? [],
        stale: true,
        fetched: true,
        error: error instanceof Error ? error.message : "Calendar sync failed.",
        fetchedAt: existing?.fetchedAt ?? null,
      };
    }
  }
}

export const calendarCache = new CalendarCache();
