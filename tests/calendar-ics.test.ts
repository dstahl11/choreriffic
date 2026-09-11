import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { parseIcsCalendar } from "@/lib/calendar/ics";

test("ICS parsing expands recurrence exceptions, floating times, and all-day end exclusivity", async () => {
  const text = await readFile(new URL("./fixtures/calendar-recurring.ics", import.meta.url), "utf8");
  const events = parseIcsCalendar(text, { from: "2026-09-07", to: "2026-09-22" });
  assert.equal(events.some((event) => event.title === "Soccer practice" && String(event.start).includes("Sep 14")), false);
  const late = events.find((event) => event.title === "Late soccer practice");
  assert.ok(late);
  assert.equal((late.start as Date).toISOString(), "2026-09-21T23:00:00.000Z");
  const allDay = events.find((event) => event.title === "School break");
  assert.equal(allDay?.start, "2026-09-10");
  assert.equal(allDay?.end, "2026-09-13");
  const overnight = events.find((event) => event.title === "Overnight fundraiser");
  assert.equal((overnight?.start as Date).toISOString(), "2026-09-12T03:30:00.000Z");
  assert.equal((overnight?.end as Date).toISOString(), "2026-09-12T04:30:00.000Z");
});
