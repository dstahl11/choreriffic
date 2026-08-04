import assert from "node:assert/strict";
import test from "node:test";
import { OccurrenceStatus, PrismaClient } from "@prisma/client";
import { deleteChorePermanently } from "@/lib/chore-service";
import { parseCalendarDate } from "@/lib/date";

test(
  "permanent deletion removes a chore and its non-completed occurrences",
  { skip: !process.env.DATABASE_URL },
  async () => {
    const prisma = new PrismaClient();
    const personId = "delete-integration-person";
    const choreId = "delete-integration-chore";

    try {
      await prisma.occurrence.deleteMany({ where: { choreId } });
      await prisma.chore.deleteMany({ where: { id: choreId } });
      await prisma.person.deleteMany({ where: { id: personId } });
      await prisma.person.create({
        data: { id: personId, name: "Delete Test", color: "#48b2ee", sortOrder: 999 },
      });
      await prisma.chore.create({
        data: {
          id: choreId,
          title: "Delete Integration Chore",
          active: false,
          rrule: "FREQ=WEEKLY;BYDAY=SU",
          dtstart: parseCalendarDate("2030-01-06"),
          assignees: { create: { personId, sortOrder: 0 } },
          occurrences: {
            create: [
              { date: parseCalendarDate("2030-01-06"), personId, assignmentSlot: 0 },
              {
                date: parseCalendarDate("2030-01-13"),
                personId,
                assignmentSlot: 0,
                status: OccurrenceStatus.skipped,
              },
            ],
          },
        },
      });

      const result = await deleteChorePermanently(prisma, choreId);
      assert.deepEqual(result, { deleted: true, reason: null });
      assert.equal(await prisma.chore.count({ where: { id: choreId } }), 0);
      assert.equal(await prisma.occurrence.count({ where: { choreId } }), 0);
    } finally {
      await prisma.occurrence.deleteMany({ where: { choreId } });
      await prisma.chore.deleteMany({ where: { id: choreId } });
      await prisma.person.deleteMany({ where: { id: personId } });
      await prisma.$disconnect();
    }
  },
);

test(
  "permanent deletion preserves chores with completed reporting history",
  { skip: !process.env.DATABASE_URL },
  async () => {
    const prisma = new PrismaClient();
    const personId = "delete-history-person";
    const choreId = "delete-history-chore";

    try {
      await prisma.occurrence.deleteMany({ where: { choreId } });
      await prisma.chore.deleteMany({ where: { id: choreId } });
      await prisma.person.deleteMany({ where: { id: personId } });
      await prisma.person.create({
        data: { id: personId, name: "History Test", color: "#f0913b", sortOrder: 1000 },
      });
      await prisma.chore.create({
        data: {
          id: choreId,
          title: "History Integration Chore",
          active: false,
          rrule: "FREQ=WEEKLY;BYDAY=SU",
          dtstart: parseCalendarDate("2030-01-06"),
          assignees: { create: { personId, sortOrder: 0 } },
          occurrences: {
            create: {
              date: parseCalendarDate("2030-01-06"),
              personId,
              assignmentSlot: 0,
              status: OccurrenceStatus.done,
              completedAt: new Date("2030-01-06T15:00:00.000Z"),
            },
          },
        },
      });

      const result = await deleteChorePermanently(prisma, choreId);
      assert.deepEqual(result, { deleted: false, reason: "has_completed_history" });
      assert.equal(await prisma.chore.count({ where: { id: choreId } }), 1);
      assert.equal(await prisma.occurrence.count({ where: { choreId } }), 1);
    } finally {
      await prisma.occurrence.deleteMany({ where: { choreId } });
      await prisma.chore.deleteMany({ where: { id: choreId } });
      await prisma.person.deleteMany({ where: { id: personId } });
      await prisma.$disconnect();
    }
  },
);
