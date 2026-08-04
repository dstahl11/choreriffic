import type { OccurrenceStatus, Prisma, PrismaClient } from "@prisma/client";
import { calendarDaySpan, formatCalendarDate, parseCalendarDate } from "@/lib/date";
import { materializeOccurrences } from "@/lib/materialize";

export const occurrenceInclude = {
  chore: true,
  person: true,
} satisfies Prisma.OccurrenceInclude;

export type OccurrenceWithRelations = Prisma.OccurrenceGetPayload<{
  include: typeof occurrenceInclude;
}>;

export function serializeOccurrence(occurrence: OccurrenceWithRelations) {
  return {
    ...occurrence,
    date: formatCalendarDate(occurrence.date),
    completedAt: occurrence.completedAt?.toISOString() ?? null,
    createdAt: occurrence.createdAt.toISOString(),
    updatedAt: occurrence.updatedAt.toISOString(),
    chore: {
      ...occurrence.chore,
      dtstart: formatCalendarDate(occurrence.chore.dtstart),
      createdAt: occurrence.chore.createdAt.toISOString(),
      updatedAt: occurrence.chore.updatedAt.toISOString(),
    },
  };
}

export type OccurrenceQuery = {
  from: string;
  to: string;
  personId?: string;
  status?: OccurrenceStatus;
};

export async function queryOccurrences(prisma: PrismaClient, query: OccurrenceQuery) {
  const from = parseCalendarDate(query.from);
  const to = parseCalendarDate(query.to);
  const span = calendarDaySpan(from, to);

  if (span < 0) {
    throw new Error("The start date must be before or equal to the end date.");
  }
  if (span > 366) {
    throw new Error("A single occurrence request cannot exceed 366 days.");
  }

  await materializeOccurrences(prisma, { from, to });

  return prisma.occurrence.findMany({
    where: {
      date: { gte: from, lte: to },
      personId: query.personId || undefined,
      status: query.status,
    },
    include: occurrenceInclude,
    orderBy: [
      { date: "asc" },
      { person: { sortOrder: "asc" } },
      { chore: { title: "asc" } },
    ],
  });
}
