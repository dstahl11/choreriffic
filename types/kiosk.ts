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
};
