import { OccurrenceStatus } from "@prisma/client";
import { NextResponse } from "next/server";
import { setOccurrenceStatus } from "@/lib/occurrence-status";
import { prisma } from "@/lib/prisma";

export async function POST(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const occurrence = await setOccurrenceStatus(prisma, id, OccurrenceStatus.skipped);
  return occurrence
    ? NextResponse.json({ data: occurrence })
    : NextResponse.json({ error: "Occurrence not found." }, { status: 404 });
}
