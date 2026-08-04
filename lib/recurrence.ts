import { RRule } from "rrule";
import { normalizeCalendarDate } from "@/lib/date";

export type OrderedAssignee = {
  personId: string;
  sortOrder: number;
};

export type RecurringChore = {
  id: string;
  rrule: string;
  dtstart: Date;
  rotation: boolean;
  assignees: OrderedAssignee[];
};

export type ExpandedOccurrence = {
  choreId: string;
  date: Date;
  assignmentSlot: number;
  personId: string;
  occurrenceIndex: number;
};

export type CalendarRange = {
  from: Date;
  to: Date;
};

function buildRule(chore: RecurringChore): RRule {
  const options = RRule.parseString(chore.rrule);
  return new RRule({
    ...options,
    dtstart: normalizeCalendarDate(chore.dtstart),
  });
}

export function expandChoreOccurrences(
  chore: RecurringChore,
  range: CalendarRange,
): ExpandedOccurrence[] {
  const from = normalizeCalendarDate(range.from);
  const to = normalizeCalendarDate(range.to);
  const dtstart = normalizeCalendarDate(chore.dtstart);

  if (to < from || to < dtstart) {
    return [];
  }

  const assignees = [...chore.assignees].sort(
    (left, right) => left.sortOrder - right.sortOrder,
  );

  if (assignees.length === 0) {
    throw new Error(`Chore ${chore.id} has no assignees.`);
  }

  const rule = buildRule(chore);
  const sequence = rule.between(dtstart, to, true);

  return sequence.flatMap((date, occurrenceIndex) => {
    const calendarDate = normalizeCalendarDate(date);
    if (calendarDate < from) {
      return [];
    }

    if (chore.rotation) {
      const assigneeIndex = occurrenceIndex % assignees.length;
      return [{
        choreId: chore.id,
        date: calendarDate,
        assignmentSlot: 0,
        personId: assignees[assigneeIndex].personId,
        occurrenceIndex,
      }];
    }

    return assignees.map((assignee, assignmentSlot) => ({
      choreId: chore.id,
      date: calendarDate,
      assignmentSlot,
      personId: assignee.personId,
      occurrenceIndex,
    }));
  });
}
