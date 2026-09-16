import assert from "node:assert/strict";
import test from "node:test";
import { nextRotationStep, resumeKioskView, rotationSchedule } from "@/lib/rotation";

const settings = {
  rotationEnabled: true,
  rotationChoresSeconds: 90,
  rotationCalendarSeconds: 45,
  rotationCalendarRange: "day" as const,
  calendarDefaultRange: "week" as const,
  calendarEnabled: true,
};

test("rotation schedule alternates Today and Calendar with configured dwell times", () => {
  assert.deepEqual(rotationSchedule(settings), [
    { view: "today", dwellMs: 90_000 },
    { view: "calendar", dwellMs: 45_000 },
  ]);
  assert.equal(nextRotationStep(rotationSchedule(settings), 0), 1);
  assert.equal(nextRotationStep(rotationSchedule(settings), 1), 0);
});

test("rotation schedule is empty unless rotation and a calendar are enabled", () => {
  assert.deepEqual(rotationSchedule({ ...settings, rotationEnabled: false }), []);
  assert.deepEqual(rotationSchedule({ ...settings, calendarEnabled: false }), []);
});

test("idle resumes Calendar unless automatic rotation has a schedule", () => {
  assert.equal(resumeKioskView(false, []), "calendar");
  assert.equal(resumeKioskView(false, rotationSchedule(settings)), "calendar");
  assert.equal(resumeKioskView(true, []), "calendar");
  assert.equal(resumeKioskView(true, rotationSchedule(settings)), "today");
});
