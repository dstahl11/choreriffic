import { PrismaClient, TimeOfDay } from "@prisma/client";
import { parseCalendarDate } from "@/lib/date";

const prisma = new PrismaClient();

const people = [
  { id: "demo-person-alex", name: "Demo Alex", color: "#48b2ee", sortOrder: 0 },
  { id: "demo-person-bailey", name: "Demo Bailey", color: "#f0913b", sortOrder: 1 },
  { id: "demo-person-casey", name: "Demo Casey", color: "#6faf52", sortOrder: 2 },
];

const chores = [
  {
    id: "demo-chore-daily",
    title: "Feed demo pet",
    rrule: "FREQ=DAILY",
    dtstart: "2026-08-03",
    rotation: false,
    timeOfDay: TimeOfDay.morning,
    assignees: ["demo-person-alex"],
  },
  {
    id: "demo-chore-multiday",
    title: "Set demo table",
    rrule: "FREQ=WEEKLY;BYDAY=MO,TH",
    dtstart: "2026-08-03",
    rotation: false,
    timeOfDay: TimeOfDay.evening,
    assignees: ["demo-person-bailey"],
  },
  {
    id: "demo-chore-rotating",
    title: "Take out demo bins",
    rrule: "FREQ=WEEKLY;BYDAY=MO",
    dtstart: "2026-08-03",
    rotation: true,
    timeOfDay: TimeOfDay.evening,
    assignees: [
      "demo-person-alex",
      "demo-person-bailey",
      "demo-person-casey",
    ],
  },
  {
    id: "demo-chore-biweekly",
    title: "Water demo plants",
    rrule: "FREQ=WEEKLY;INTERVAL=2;BYDAY=SA",
    dtstart: "2026-08-03",
    rotation: false,
    timeOfDay: TimeOfDay.anytime,
    assignees: ["demo-person-casey"],
  },
];

async function main() {
  for (const person of people) {
    await prisma.person.upsert({
      where: { id: person.id },
      create: person,
      update: person,
    });
  }

  for (const chore of chores) {
    await prisma.$transaction(async (tx) => {
      await tx.chore.upsert({
        where: { id: chore.id },
        create: {
          id: chore.id,
          title: chore.title,
          description: "Demo seed data — replace before production.",
          rrule: chore.rrule,
          dtstart: parseCalendarDate(chore.dtstart),
          rotation: chore.rotation,
          timeOfDay: chore.timeOfDay,
          assignees: {
            create: chore.assignees.map((personId, sortOrder) => ({
              personId,
              sortOrder,
            })),
          },
        },
        update: {
          title: chore.title,
          description: "Demo seed data — replace before production.",
          active: true,
          rrule: chore.rrule,
          dtstart: parseCalendarDate(chore.dtstart),
          rotation: chore.rotation,
          timeOfDay: chore.timeOfDay,
        },
      });

      await tx.choreAssignee.deleteMany({ where: { choreId: chore.id } });
      await tx.choreAssignee.createMany({
        data: chore.assignees.map((personId, sortOrder) => ({
          choreId: chore.id,
          personId,
          sortOrder,
        })),
      });
    });
  }

  console.log(`Seeded ${people.length} demo people and ${chores.length} demo chores.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
