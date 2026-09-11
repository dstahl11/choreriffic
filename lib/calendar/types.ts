import type { CalendarSourceKind } from "@prisma/client";

export type CalendarSourceConfig = {
  id: string;
  kind: CalendarSourceKind;
  name: string;
  color: string;
  googleCalendarId: string | null;
  icsUrl: string | null;
  showLocation: boolean;
};

export type ProviderCalendarEvent = {
  providerEventId: string;
  title: string;
  location: string | null;
  color: string | null;
  allDay: boolean;
  start: string | Date;
  end: string | Date;
};

export type CalendarQueryRange = { from: string; to: string };
