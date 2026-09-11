import { NextRequest, NextResponse } from "next/server";
import { apiError } from "@/lib/api-response";
import { getCalendarEvents } from "@/lib/calendar/service";
import { calendarDaySpan, parseCalendarDate } from "@/lib/date";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  try {
    const from = request.nextUrl.searchParams.get("from");
    const to = request.nextUrl.searchParams.get("to");
    if (!from || !to) throw new Error("Both from and to are required.");
    const fromDate = parseCalendarDate(from);
    const toDate = parseCalendarDate(to);
    const span = calendarDaySpan(fromDate, toDate);
    if (span < 0) throw new Error("from must be on or before to.");
    if (span > 30) throw new Error("Calendar ranges may not exceed 31 days.");
    const data = await getCalendarEvents(prisma, { from, to });
    return NextResponse.json({ data }, { headers: { "cache-control": "no-store" } });
  } catch (error) {
    return apiError(error);
  }
}
