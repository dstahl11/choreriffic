import { OccurrenceStatus } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { apiError } from "@/lib/api-response";
import { setOccurrenceStatus } from "@/lib/occurrence-status";
import { prisma } from "@/lib/prisma";

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const body = (await request.json()) as { done?: unknown };
    if (typeof body.done !== "boolean") throw new Error("done must be true or false.");
    const occurrence = await setOccurrenceStatus(
      prisma,
      id,
      body.done ? OccurrenceStatus.done : OccurrenceStatus.pending,
    );
    return occurrence
      ? NextResponse.json({ data: occurrence })
      : NextResponse.json({ error: "Occurrence not found." }, { status: 404 });
  } catch (error) {
    return apiError(error);
  }
}
