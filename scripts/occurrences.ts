import { prisma } from "@/lib/prisma";
import { formatCalendarDate, parseCalendarDate } from "@/lib/date";
import { materializeOccurrences } from "@/lib/materialize";

async function main() {
  const [fromValue, toValue] = process.argv.slice(2);

  if (!fromValue || !toValue) {
    throw new Error("Usage: npx tsx scripts/occurrences.ts <from> <to>");
  }

  const from = parseCalendarDate(fromValue);
  const to = parseCalendarDate(toValue);
  await materializeOccurrences(prisma, { from, to });

  const occurrences = await prisma.occurrence.findMany({
    where: { date: { gte: from, lte: to } },
    include: { chore: true, person: true },
    orderBy: [{ date: "asc" }, { choreId: "asc" }],
  });

  console.table(
    occurrences.map((occurrence) => ({
      date: formatCalendarDate(occurrence.date),
      chore: occurrence.chore.title,
      person: occurrence.person.name,
      status: occurrence.status,
    })),
  );

  console.log(`${occurrences.length} occurrences in ${fromValue} through ${toValue}.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
