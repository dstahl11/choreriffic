import type { PrismaClient } from "@prisma/client";
import type { CalendarRange } from "@/lib/recurrence";
import { expandChoreOccurrences } from "@/lib/recurrence";

export async function materializeOccurrences(
  prisma: PrismaClient,
  range: CalendarRange,
): Promise<number> {
  const chores = await prisma.chore.findMany({
    where: { active: true },
    include: {
      assignees: {
        orderBy: { sortOrder: "asc" },
      },
    },
    orderBy: { id: "asc" },
  });

  const desired = chores.flatMap((chore) =>
    expandChoreOccurrences(
      {
        id: chore.id,
        rrule: chore.rrule,
        dtstart: chore.dtstart,
        rotation: chore.rotation,
        assignees: chore.assignees.map((assignee) => ({
          personId: assignee.personId,
          sortOrder: assignee.sortOrder,
        })),
      },
      range,
    ),
  );

  if (desired.length === 0) {
    return 0;
  }

  await prisma.$transaction(
    desired.map((occurrence) =>
      prisma.occurrence.upsert({
        where: {
          choreId_date_assignmentSlot: {
            choreId: occurrence.choreId,
            date: occurrence.date,
            assignmentSlot: occurrence.assignmentSlot,
          },
        },
        create: {
          choreId: occurrence.choreId,
          date: occurrence.date,
          assignmentSlot: occurrence.assignmentSlot,
          personId: occurrence.personId,
        },
        update: {},
      }),
    ),
  );

  return desired.length;
}
