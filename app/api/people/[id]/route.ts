import { NextRequest, NextResponse } from "next/server";
import { apiError } from "@/lib/api-response";
import { prisma } from "@/lib/prisma";
import { parseJsonBody, personPatchSchema } from "@/lib/validation";

export async function GET(_request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const person = await prisma.person.findUnique({ where: { id } });
  return person
    ? NextResponse.json({ data: person })
    : NextResponse.json({ error: "Person not found." }, { status: 404 });
}

export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const input = parseJsonBody(personPatchSchema, await request.json());
    const person = await prisma.person.update({ where: { id }, data: input });
    return NextResponse.json({ data: person });
  } catch (error) {
    return apiError(error);
  }
}

export async function DELETE(_request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const links = await prisma.choreAssignee.count({ where: { personId: id } });
  const occurrences = await prisma.occurrence.count({ where: { personId: id } });
  if (links || occurrences) {
    return NextResponse.json(
      { error: "This person still has chores or occurrence history. Reassign those records first." },
      { status: 409 },
    );
  }
  await prisma.person.delete({ where: { id } });
  return new NextResponse(null, { status: 204 });
}
