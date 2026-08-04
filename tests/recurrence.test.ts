import assert from "node:assert/strict";
import test from "node:test";
import { formatCalendarDate, parseCalendarDate } from "@/lib/date";
import { expandChoreOccurrences } from "@/lib/recurrence";

const assignees = [
  { personId: "alex", sortOrder: 0 },
  { personId: "bailey", sortOrder: 1 },
  { personId: "casey", sortOrder: 2 },
];

test("weekly rotation derives A, B, C, A, B, C without a stored pointer", () => {
  const occurrences = expandChoreOccurrences(
    {
      id: "rotating",
      rrule: "FREQ=WEEKLY;BYDAY=MO",
      dtstart: parseCalendarDate("2026-08-03"),
      rotation: true,
      assignees,
    },
    {
      from: parseCalendarDate("2026-08-03"),
      to: parseCalendarDate("2026-09-07"),
    },
  );

  assert.deepEqual(
    occurrences.map((occurrence) => occurrence.personId),
    ["alex", "bailey", "casey", "alex", "bailey", "casey"],
  );
  assert.deepEqual(
    occurrences.map((occurrence) => occurrence.occurrenceIndex),
    [0, 1, 2, 3, 4, 5],
  );
});

test("rotation remains anchored when a later range starts mid-sequence", () => {
  const occurrences = expandChoreOccurrences(
    {
      id: "rotating",
      rrule: "FREQ=WEEKLY;BYDAY=MO",
      dtstart: parseCalendarDate("2026-08-03"),
      rotation: true,
      assignees,
    },
    {
      from: parseCalendarDate("2026-08-24"),
      to: parseCalendarDate("2026-09-07"),
    },
  );

  assert.deepEqual(
    occurrences.map((occurrence) => [
      formatCalendarDate(occurrence.date),
      occurrence.personId,
    ]),
    [
      ["2026-08-24", "alex"],
      ["2026-08-31", "bailey"],
      ["2026-09-07", "casey"],
    ],
  );
});

test("non-rotating chores create one occurrence for every selected person", () => {
  const occurrences = expandChoreOccurrences(
    {
      id: "shared",
      rrule: "FREQ=DAILY",
      dtstart: parseCalendarDate("2026-08-03"),
      rotation: false,
      assignees,
    },
    {
      from: parseCalendarDate("2026-08-03"),
      to: parseCalendarDate("2026-08-04"),
    },
  );

  assert.deepEqual(
    occurrences.map((occurrence) => [
      formatCalendarDate(occurrence.date),
      occurrence.assignmentSlot,
      occurrence.personId,
    ]),
    [
      ["2026-08-03", 0, "alex"],
      ["2026-08-03", 1, "bailey"],
      ["2026-08-03", 2, "casey"],
      ["2026-08-04", 0, "alex"],
      ["2026-08-04", 1, "bailey"],
      ["2026-08-04", 2, "casey"],
    ],
  );
});

test("a biweekly rule skips alternate weeks", () => {
  const occurrences = expandChoreOccurrences(
    {
      id: "biweekly",
      rrule: "FREQ=WEEKLY;INTERVAL=2;BYDAY=SA",
      dtstart: parseCalendarDate("2026-08-03"),
      rotation: false,
      assignees: [{ personId: "casey", sortOrder: 0 }],
    },
    {
      from: parseCalendarDate("2026-08-03"),
      to: parseCalendarDate("2026-09-13"),
    },
  );

  assert.deepEqual(
    occurrences.map((occurrence) => formatCalendarDate(occurrence.date)),
    ["2026-08-08", "2026-08-22", "2026-09-05"],
  );
});

test("multi-day weekly rules include both configured weekdays", () => {
  const occurrences = expandChoreOccurrences(
    {
      id: "multi-day",
      rrule: "FREQ=WEEKLY;BYDAY=MO,TH",
      dtstart: parseCalendarDate("2026-08-03"),
      rotation: false,
      assignees: [{ personId: "bailey", sortOrder: 0 }],
    },
    {
      from: parseCalendarDate("2026-08-03"),
      to: parseCalendarDate("2026-08-10"),
    },
  );

  assert.deepEqual(
    occurrences.map((occurrence) => formatCalendarDate(occurrence.date)),
    ["2026-08-03", "2026-08-06", "2026-08-10"],
  );
});

test("invalid and reversed ranges are handled safely", () => {
  assert.throws(() => parseCalendarDate("08/03/2026"), /Invalid calendar date/);

  const occurrences = expandChoreOccurrences(
    {
      id: "daily",
      rrule: "FREQ=DAILY",
      dtstart: parseCalendarDate("2026-08-03"),
      rotation: false,
      assignees: [{ personId: "alex", sortOrder: 0 }],
    },
    {
      from: parseCalendarDate("2026-08-10"),
      to: parseCalendarDate("2026-08-03"),
    },
  );

  assert.deepEqual(occurrences, []);
});
