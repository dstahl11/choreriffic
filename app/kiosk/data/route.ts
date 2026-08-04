import { OccurrenceStatus } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { apiError } from "@/lib/api-response";
import { queryOccurrences, serializeOccurrence } from "@/lib/occurrences";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  try {
    const from = request.nextUrl.searchParams.get("from");
    const to = request.nextUrl.searchParams.get("to");
    if (!from || !to) throw new Error("Both from and to are required.");

    const [people, occurrences] = await Promise.all([
      prisma.person.findMany({ orderBy: { sortOrder: "asc" } }),
      queryOccurrences(prisma, { from, to }),
    ]);

    return NextResponse.json({
      data: {
        people,
        occurrences: occurrences
          .filter((occurrence) => occurrence.status !== OccurrenceStatus.skipped)
          .map(serializeOccurrence),
      },
    });
  } catch (error) {
    return apiError(error);
  }
}
