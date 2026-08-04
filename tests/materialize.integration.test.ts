import assert from "node:assert/strict";
import test from "node:test";
import { OccurrenceStatus, PrismaClient, TimeOfDay } from "@prisma/client";
import { parseCalendarDate } from "@/lib/date";
import { materializeOccurrences } from "@/lib/materialize";

test(
  "materialization is idempotent and preserves a completed occurrence",
  { skip: !process.env.DATABASE_URL },
  async () => {
    const prisma = new PrismaClient();
    const personId = "integration-person";
    const secondPersonId = "integration-person-two";
    const choreId = "integration-chore";
    const range = {
      from: parseCalendarDate("2030-01-07"),
      to: parseCalendarDate("2030-01-14"),
    };

    try {
      await prisma.occurrence.deleteMany({ where: { choreId } });
      await prisma.choreAssignee.deleteMany({ where: { choreId } });
      await prisma.chore.deleteMany({ where: { id: choreId } });
      await prisma.person.deleteMany({ where: { id: { in: [personId, secondPersonId] } } });

      await prisma.person.create({
        data: {
          id: personId,
          name: "Integration Person",
          color: "#48b2ee",
          sortOrder: 99,
        },
      });
      await prisma.person.create({
        data: {
          id: secondPersonId,
          name: "Integration Person Two",
          color: "#f0913b",
          sortOrder: 100,
        },
      });
      await prisma.chore.create({
        data: {
          id: choreId,
          title: "Integration Chore",
          rrule: "FREQ=WEEKLY;BYDAY=MO",
          dtstart: range.from,
          rotation: false,
          timeOfDay: TimeOfDay.anytime,
          assignees: {
            create: [
              { personId, sortOrder: 0 },
              { personId: secondPersonId, sortOrder: 1 },
            ],
          },
        },
      });

      await materializeOccurrences(prisma, range);
      await materializeOccurrences(prisma, range);

      const before = await prisma.occurrence.findMany({
        where: { choreId },
        orderBy: [{ date: "asc" }, { assignmentSlot: "asc" }],
      });
      assert.equal(before.length, 4);
      assert.deepEqual(
        before.slice(0, 2).map((occurrence) => occurrence.personId),
        [personId, secondPersonId],
      );

      const completedAt = new Date("2030-01-07T15:00:00.000Z");
      await prisma.occurrence.update({
        where: { id: before[0].id },
        data: { status: OccurrenceStatus.done, completedAt },
      });

      await materializeOccurrences(prisma, range);

      const after = await prisma.occurrence.findMany({
        where: { choreId },
        orderBy: [{ date: "asc" }, { assignmentSlot: "asc" }],
      });
      assert.equal(after.length, 4);
      assert.equal(after[0].status, OccurrenceStatus.done);
      assert.equal(after[0].completedAt?.toISOString(), completedAt.toISOString());
    } finally {
      await prisma.occurrence.deleteMany({ where: { choreId } });
      await prisma.choreAssignee.deleteMany({ where: { choreId } });
      await prisma.chore.deleteMany({ where: { id: choreId } });
      await prisma.person.deleteMany({ where: { id: { in: [personId, secondPersonId] } } });
      await prisma.$disconnect();
    }
  },
);
