import type { Prisma, PrismaClient } from "@prisma/client";
import { parseCalendarDate, todayInAppTimeZone } from "@/lib/date";
import type { choreInputSchema, chorePatchSchema } from "@/lib/validation";
import type { z } from "zod";

type ChoreInput = z.infer<typeof choreInputSchema>;
type ChorePatch = z.infer<typeof chorePatchSchema>;

export const choreInclude = {
  assignees: {
    include: { person: true },
    orderBy: { sortOrder: "asc" as const },
  },
} satisfies Prisma.ChoreInclude;

export async function createChore(prisma: PrismaClient, input: ChoreInput) {
  return prisma.chore.create({
    data: {
      title: input.title,
      description: input.description || null,
      active: input.active,
      rrule: input.rrule,
      dtstart: parseCalendarDate(input.dtstart),
      rotation: input.rotation,
      timeOfDay: input.timeOfDay || null,
      assignees: {
        create: input.assigneeIds.map((personId, sortOrder) => ({ personId, sortOrder })),
      },
    },
    include: choreInclude,
  });
}

export async function updateChore(
  prisma: PrismaClient,
  id: string,
  input: ChorePatch,
) {
  const existing = await prisma.chore.findUnique({
    where: { id },
    include: { assignees: { orderBy: { sortOrder: "asc" } } },
  });
  if (!existing) return null;

  const scheduleChanged =
    input.rrule !== undefined ||
    input.dtstart !== undefined ||
    input.rotation !== undefined ||
    input.assigneeIds !== undefined;

  return prisma.$transaction(async (tx) => {
    if (input.assigneeIds) {
      await tx.choreAssignee.deleteMany({ where: { choreId: id } });
      await tx.choreAssignee.createMany({
        data: input.assigneeIds.map((personId, sortOrder) => ({
          choreId: id,
          personId,
          sortOrder,
        })),
      });
    }

    const chore = await tx.chore.update({
      where: { id },
      data: {
        title: input.title,
        description: input.description === undefined ? undefined : input.description || null,
        active: input.active,
        rrule: input.rrule,
        dtstart: input.dtstart ? parseCalendarDate(input.dtstart) : undefined,
        rotation: input.rotation,
        timeOfDay: input.timeOfDay === undefined ? undefined : input.timeOfDay,
      },
      include: choreInclude,
    });

    if (scheduleChanged) {
      await tx.occurrence.deleteMany({
        where: {
          choreId: id,
          date: { gte: todayInAppTimeZone() },
          status: "pending",
        },
      });
    }

    return chore;
  });
}

export type DeleteChoreResult =
  | { deleted: true; reason: null }
  | { deleted: false; reason: "not_found" | "has_completed_history" };

/**
 * Permanently removes a chore only when doing so cannot erase completion
 * history. Pending and skipped occurrences are schedule data and are removed
 * along with the chore; completed occurrences remain protected for reports.
 */
export async function deleteChorePermanently(
  prisma: PrismaClient,
  id: string,
): Promise<DeleteChoreResult> {
  return prisma.$transaction(async (tx) => {
    const chore = await tx.chore.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!chore) return { deleted: false, reason: "not_found" };

    const completedCount = await tx.occurrence.count({
      where: { choreId: id, status: "done" },
    });
    if (completedCount > 0) {
      return { deleted: false, reason: "has_completed_history" };
    }

    // The status guard also protects a completion that races this request after
    // the count above: the completed row remains, and the restrictive foreign
    // key prevents the chore itself from being removed.
    await tx.occurrence.deleteMany({
      where: { choreId: id, status: { not: "done" } },
    });
    await tx.chore.delete({ where: { id } });
    return { deleted: true, reason: null };
  });
}
