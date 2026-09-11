import assert from "node:assert/strict";
import test from "node:test";
import { CalendarCache } from "@/lib/calendar/cache";
import type { KioskCalendarEvent } from "@/types/kiosk";

const event: KioskCalendarEvent = {
  id: "source:event:start", sourceId: "source", sourceName: "Family", color: "#123456",
  title: "Event", location: null, allDay: true, start: "2026-09-11", end: "2026-09-12", days: ["2026-09-11"],
};

test("calendar cache honors TTL and returns last-good data after failures", async () => {
  const cache = new CalendarCache();
  let calls = 0;
  const fetcher = async () => { calls += 1; return [event]; };
  assert.equal((await cache.get("source", "a", 100, fetcher, 1_000)).stale, false);
  assert.equal((await cache.get("source", "a", 100, fetcher, 1_050)).fetched, false);
  const fallback = await cache.get("source", "a", 100, async () => { throw new Error("offline"); }, 1_200);
  assert.equal(calls, 1);
  assert.equal(fallback.stale, true);
  assert.equal(fallback.error, "offline");
  assert.deepEqual(fallback.events, [event]);
});

test("calendar cache caps ranges per source using LRU order", async () => {
  const cache = new CalendarCache(2);
  await cache.get("source", "a", 1, async () => [event], 1);
  await cache.get("source", "b", 1, async () => [event], 2);
  await cache.get("source", "c", 1, async () => [event], 3);
  assert.equal(cache.sizeForSource("source"), 2);
  cache.clearSource("source");
  assert.equal(cache.sizeForSource("source"), 0);
});
