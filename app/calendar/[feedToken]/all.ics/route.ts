import ical, { ICalCalendarMethod } from "ical-generator";
import { NextResponse } from "next/server";
import { addCalendarDays, APP_TIME_ZONE, todayInAppTimeZone } from "@/lib/date";
import { queryOccurrences } from "@/lib/occurrences";
import { prisma } from "@/lib/prisma";
import { safeStringEqual } from "@/lib/safe-compare";
import { formatCalendarDate } from "@/lib/date";

export async function GET(_request: Request, context: { params: Promise<{ feedToken: string }> }) {
  const { feedToken } = await context.params;
  if (!process.env.FEED_TOKEN || !safeStringEqual(feedToken, process.env.FEED_TOKEN)) {
    return NextResponse.json({ error: "Calendar feed not found." }, { status: 404 });
  }
  const from = todayInAppTimeZone();
  const to = addCalendarDays(from, 60);
  const occurrences = await queryOccurrences(prisma, {
    from: formatCalendarDate(from),
    to: formatCalendarDate(to),
  });
  const calendar = ical({
    name: "ChoreBoard",
    timezone: APP_TIME_ZONE,
    method: ICalCalendarMethod.PUBLISH,
    prodId: { company: "ChoreBoard", product: "ChoreBoard" },
  });
  for (const occurrence of occurrences) {
    calendar.createEvent({
      id: occurrence.id,
      start: occurrence.date,
      allDay: true,
      summary: `[${occurrence.person.name}] ${occurrence.chore.title}`,
      description: occurrence.chore.description || undefined,
    });
  }
  return new NextResponse(calendar.toString(), {
    headers: {
      "content-type": "text/calendar; charset=utf-8",
      "content-disposition": 'inline; filename="choreboard-all.ics"',
      "cache-control": "private, max-age=300",
    },
  });
}
