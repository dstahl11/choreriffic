import assert from "node:assert/strict";
import test from "node:test";
import { calendarSourceInputSchema, kioskSettingsInputSchema } from "@/lib/validation";
import { isPrivateCalendarAddress } from "@/lib/calendar/ics";

const base = { name: "Family", color: "#abcdef", enabled: true, sortOrder: 0, showLocation: true };

test("Google sources require a calendar ID and exclude ICS URLs", () => {
  assert.equal(calendarSourceInputSchema.safeParse({ ...base, kind: "google", googleCalendarId: "family@example.com", icsUrl: null }).success, true);
  assert.equal(calendarSourceInputSchema.safeParse({ ...base, kind: "google", googleCalendarId: "missing-at", icsUrl: null }).success, false);
});

test("ICS sources accept webcal URLs and normalize them to HTTPS", () => {
  const parsed = calendarSourceInputSchema.parse({ ...base, kind: "ics", googleCalendarId: null, icsUrl: "webcal://example.com/family.ics" });
  assert.equal(parsed.icsUrl, "https://example.com/family.ics");
  assert.equal(calendarSourceInputSchema.safeParse({ ...base, kind: "ics", googleCalendarId: null, icsUrl: "file:///tmp/calendar.ics" }).success, false);
});

test("private calendar addresses and unsafe rotation values are rejected", () => {
  assert.equal(isPrivateCalendarAddress("192.168.1.2"), true);
  assert.equal(isPrivateCalendarAddress("10.1.2.3"), true);
  assert.equal(isPrivateCalendarAddress("8.8.8.8"), false);
  assert.equal(kioskSettingsInputSchema.safeParse({
    rotationEnabled: true, rotationChoresSeconds: 14, rotationCalendarSeconds: 45,
    rotationCalendarRange: "day", calendarDefaultRange: "week",
  }).success, false);
});
