import type { KioskSettings } from "@/types/kiosk";

export type RotationStep = { view: "today" | "calendar"; dwellMs: number };

export function resumeKioskView(enabled: boolean, schedule: RotationStep[]): RotationStep["view"] {
  return enabled && schedule.length ? schedule[0].view : "calendar";
}

export function rotationSchedule(settings: KioskSettings): RotationStep[] {
  if (!settings.rotationEnabled || !settings.calendarEnabled) return [];
  return [
    { view: "today", dwellMs: settings.rotationChoresSeconds * 1000 },
    { view: "calendar", dwellMs: settings.rotationCalendarSeconds * 1000 },
  ];
}

export function nextRotationStep(schedule: RotationStep[], index: number) {
  return schedule.length ? (index + 1) % schedule.length : 0;
}
