import assert from "node:assert/strict";
import test from "node:test";
import { normalizeCalendarEvents } from "@/lib/calendar/normalize";
import type { CalendarSourceConfig, ProviderCalendarEvent } from "@/lib/calendar/types";

const source: CalendarSourceConfig = {
  id: "family",
  kind: "google",
  name: "Family",
  color: "#123456",
  googleCalendarId: "family@example.com",
  icsUrl: null,
  showLocation: true,
};

test("normalization expands all-day events without the exclusive end date", () => {
  const events = normalizeCalendarEvents(source, [{
    providerEventId: "break",
    title: "School break",
    location: null,
    color: null,
    allDay: true,
    start: "2026-09-10",
    end: "2026-09-13",
  }], { from: "2026-09-09", to: "2026-09-14" });
  assert.deepEqual(events[0].days, ["2026-09-10", "2026-09-11", "2026-09-12"]);
  assert.equal(events[0].color, source.color);
});

test("normalization renders timed events in app time and expands cross-midnight events", () => {
  const events = normalizeCalendarEvents(source, [{
    providerEventId: "late",
    title: "Late game",
    location: "Gym",
    color: "#abcdef",
    allDay: false,
    start: new Date("2026-09-12T03:30:00Z"),
    end: new Date("2026-09-12T04:30:00Z"),
  }], { from: "2026-09-11", to: "2026-09-12" });
  assert.equal(events[0].start, "2026-09-11T23:30:00-04:00");
  assert.deepEqual(events[0].days, ["2026-09-11", "2026-09-12"]);
  assert.equal(events[0].location, "Gym");
});

test("normalization sorts all-day events before timed events and then by title", () => {
  const raw: ProviderCalendarEvent[] = [
    { providerEventId: "b", title: "Beta", location: null, color: null, allDay: false, start: new Date("2026-09-11T14:00:00Z"), end: new Date("2026-09-11T15:00:00Z") },
    { providerEventId: "z", title: "Zoo", location: null, color: null, allDay: true, start: "2026-09-11", end: "2026-09-12" },
    { providerEventId: "a", title: "Alpha", location: null, color: null, allDay: false, start: new Date("2026-09-11T14:00:00Z"), end: new Date("2026-09-11T15:00:00Z") },
  ];
  assert.deepEqual(
    normalizeCalendarEvents(source, raw, { from: "2026-09-11", to: "2026-09-11" }).map((event) => event.title),
    ["Zoo", "Alpha", "Beta"],
  );
});
