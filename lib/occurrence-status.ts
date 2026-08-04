import { OccurrenceStatus, type PrismaClient } from "@prisma/client";
import { occurrenceInclude, serializeOccurrence } from "@/lib/occurrences";

export async function setOccurrenceStatus(
  prisma: PrismaClient,
  id: string,
  status: OccurrenceStatus,
) {
  const existing = await prisma.occurrence.findUnique({ where: { id } });
  if (!existing) {
    return null;
  }

  const completedAt =
    status === OccurrenceStatus.done
      ? existing.status === OccurrenceStatus.done
        ? existing.completedAt
        : new Date()
      : null;

  const occurrence = await prisma.occurrence.update({
    where: { id },
    data: { status, completedAt },
    include: occurrenceInclude,
  });

  return serializeOccurrence(occurrence);
}
