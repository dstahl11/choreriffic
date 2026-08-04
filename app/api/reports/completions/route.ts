import { NextRequest, NextResponse } from "next/server";
import { OccurrenceStatus } from "@prisma/client";
import { apiError } from "@/lib/api-response";
import { queryOccurrences, serializeOccurrence } from "@/lib/occurrences";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  try {
    const from = request.nextUrl.searchParams.get("from");
    const to = request.nextUrl.searchParams.get("to");
    if (!from || !to) throw new Error("Both from and to are required in YYYY-MM-DD format.");
    const occurrences = await queryOccurrences(prisma, {
      from,
      to,
      personId: request.nextUrl.searchParams.get("person") || undefined,
      status: OccurrenceStatus.done,
    });

    const byPerson = new Map<string, { personId: string; name: string; completed: number }>();
    const byChore = new Map<string, { choreId: string; title: string; completed: number }>();
    for (const occurrence of occurrences) {
      const person = byPerson.get(occurrence.personId) ?? {
        personId: occurrence.personId,
        name: occurrence.person.name,
        completed: 0,
      };
      person.completed += 1;
      byPerson.set(occurrence.personId, person);

      const chore = byChore.get(occurrence.choreId) ?? {
        choreId: occurrence.choreId,
        title: occurrence.chore.title,
        completed: 0,
      };
      chore.completed += 1;
      byChore.set(occurrence.choreId, chore);
    }

    return NextResponse.json({
      data: {
        range: { from, to },
        totalCompleted: occurrences.length,
        byPerson: [...byPerson.values()],
        byChore: [...byChore.values()],
        rows: occurrences.map(serializeOccurrence),
      },
    });
  } catch (error) {
    return apiError(error);
  }
}
