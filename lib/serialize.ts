import { formatCalendarDate } from "@/lib/date";

export function serializeChore<T extends { dtstart: Date; createdAt: Date; updatedAt: Date }>(
  chore: T,
) {
  return {
    ...chore,
    dtstart: formatCalendarDate(chore.dtstart),
    createdAt: chore.createdAt.toISOString(),
    updatedAt: chore.updatedAt.toISOString(),
  };
}
