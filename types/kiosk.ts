export type KioskPerson = {
  id: string;
  name: string;
  color: string;
  sortOrder: number;
};

export type KioskChore = {
  id: string;
  title: string;
  description: string | null;
  timeOfDay: "morning" | "afternoon" | "evening" | "anytime" | null;
};

export type KioskOccurrence = {
  id: string;
  date: string;
  status: "pending" | "done" | "skipped";
  completedAt: string | null;
  personId: string;
  choreId: string;
  person: KioskPerson;
  chore: KioskChore;
};

export type KioskPayload = {
  people: KioskPerson[];
  occurrences: KioskOccurrence[];
  settings: KioskSettings;
};

export type CalendarRange = "day" | "week";

export type KioskSettings = {
  rotationEnabled: boolean;
  rotationChoresSeconds: number;
  rotationCalendarSeconds: number;
  rotationCalendarRange: CalendarRange;
  calendarDefaultRange: CalendarRange;
  calendarEnabled: boolean;
};

export type KioskCalendarEvent = {
  id: string;
  sourceId: string;
  sourceName: string;
  color: string;
  title: string;
  location: string | null;
  allDay: boolean;
  start: string;
  end: string;
  days: string[];
};

export type KioskCalendarPayload = {
  range: { from: string; to: string };
  events: KioskCalendarEvent[];
  sources: Array<{
    id: string;
    name: string;
    color: string;
    stale: boolean;
    lastSyncedAt: string | null;
  }>;
};
