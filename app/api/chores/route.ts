import { NextRequest, NextResponse } from "next/server";
import { apiError } from "@/lib/api-response";
import { choreInclude, createChore } from "@/lib/chore-service";
import { prisma } from "@/lib/prisma";
import { serializeChore } from "@/lib/serialize";
import { choreInputSchema, parseJsonBody } from "@/lib/validation";

export async function GET() {
  const chores = await prisma.chore.findMany({
    include: choreInclude,
    orderBy: [{ active: "desc" }, { title: "asc" }],
  });
  return NextResponse.json({ data: chores.map(serializeChore) });
}

export async function POST(request: NextRequest) {
  try {
    const input = parseJsonBody(choreInputSchema, await request.json());
    const chore = await createChore(prisma, input);
    return NextResponse.json({ data: serializeChore(chore) }, { status: 201 });
  } catch (error) {
    return apiError(error);
  }
}
