import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { addCalendarDays, todayInAppTimeZone } from "@/lib/date";
import { materializeOccurrences } from "@/lib/materialize";
import { prisma } from "@/lib/prisma";

export async function POST(request: NextRequest) {
  const parsed = z.coerce.number().int().min(1).max(366).safeParse(
    request.nextUrl.searchParams.get("days") ?? "60",
  );
  if (!parsed.success) {
    return NextResponse.json({ error: "days must be an integer from 1 through 366." }, { status: 400 });
  }
  const from = todayInAppTimeZone();
  const to = addCalendarDays(from, parsed.data);
  const attempted = await materializeOccurrences(prisma, { from, to });
  return NextResponse.json({ data: { from, to, attempted } });
}
