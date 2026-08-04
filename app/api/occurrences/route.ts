import { OccurrenceStatus } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { apiError } from "@/lib/api-response";
import { queryOccurrences, serializeOccurrence } from "@/lib/occurrences";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  try {
    const from = request.nextUrl.searchParams.get("from");
    const to = request.nextUrl.searchParams.get("to");
    if (!from || !to) throw new Error("Both from and to are required in YYYY-MM-DD format.");

    const statusValue = request.nextUrl.searchParams.get("status");
    const status = statusValue
      ? (Object.values(OccurrenceStatus).includes(statusValue as OccurrenceStatus)
          ? statusValue
          : undefined)
      : undefined;
    if (statusValue && !status) throw new Error("Status must be pending, done, or skipped.");

    const occurrences = await queryOccurrences(prisma, {
      from,
      to,
      personId: request.nextUrl.searchParams.get("person") || undefined,
      status: status as OccurrenceStatus | undefined,
    });

    return NextResponse.json({ data: occurrences.map(serializeOccurrence) });
  } catch (error) {
    return apiError(error);
  }
}
