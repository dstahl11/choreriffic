import ical, { ICalCalendarMethod } from "ical-generator";
import { NextResponse } from "next/server";
import {
  addCalendarDays,
  APP_TIME_ZONE,
  formatCalendarDate,
  todayInAppTimeZone,
} from "@/lib/date";
import { queryOccurrences } from "@/lib/occurrences";
import { prisma } from "@/lib/prisma";
import { safeStringEqual } from "@/lib/safe-compare";

export async function GET(
  _request: Request,
  context: { params: Promise<{ feedToken: string; personId: string }> },
) {
  const { feedToken, personId } = await context.params;
  if (!process.env.FEED_TOKEN || !safeStringEqual(feedToken, process.env.FEED_TOKEN)) {
    return NextResponse.json({ error: "Calendar feed not found." }, { status: 404 });
  }
  const person = await prisma.person.findUnique({ where: { id: personId } });
  if (!person) return NextResponse.json({ error: "Person not found." }, { status: 404 });
  const from = todayInAppTimeZone();
  const to = addCalendarDays(from, 60);
  const occurrences = await queryOccurrences(prisma, {
    from: formatCalendarDate(from),
    to: formatCalendarDate(to),
    personId,
  });
  const calendar = ical({
    name: `${person.name} — ChoreBoard`,
    timezone: APP_TIME_ZONE,
    method: ICalCalendarMethod.PUBLISH,
    prodId: { company: "ChoreBoard", product: "ChoreBoard" },
  });
  for (const occurrence of occurrences) {
    calendar.createEvent({
      id: occurrence.id,
      start: occurrence.date,
      allDay: true,
      summary: `[${person.name}] ${occurrence.chore.title}`,
      description: occurrence.chore.description || undefined,
    });
  }
  return new NextResponse(calendar.toString(), {
    headers: {
      "content-type": "text/calendar; charset=utf-8",
      "content-disposition": `inline; filename="choreboard-${person.id}.ics"`,
      "cache-control": "private, max-age=300",
    },
  });
}
