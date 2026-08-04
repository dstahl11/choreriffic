import { NextRequest, NextResponse } from "next/server";
import { apiError } from "@/lib/api-response";
import { choreInclude, updateChore } from "@/lib/chore-service";
import { prisma } from "@/lib/prisma";
import { serializeChore } from "@/lib/serialize";
import { chorePatchSchema, parseJsonBody } from "@/lib/validation";

export async function GET(_request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const chore = await prisma.chore.findUnique({ where: { id }, include: choreInclude });
  return chore
    ? NextResponse.json({ data: serializeChore(chore) })
    : NextResponse.json({ error: "Chore not found." }, { status: 404 });
}

export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const input = parseJsonBody(chorePatchSchema, await request.json());
    const chore = await updateChore(prisma, id, input);
    return chore
      ? NextResponse.json({ data: serializeChore(chore) })
      : NextResponse.json({ error: "Chore not found." }, { status: 404 });
  } catch (error) {
    return apiError(error);
  }
}

export async function DELETE(_request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const chore = await prisma.chore.findUnique({ where: { id } });
  if (!chore) return NextResponse.json({ error: "Chore not found." }, { status: 404 });
  const updated = await prisma.chore.update({ where: { id }, data: { active: false } });
  return NextResponse.json({ data: serializeChore(updated) });
}
