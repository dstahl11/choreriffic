import { NextRequest, NextResponse } from "next/server";
import { apiError } from "@/lib/api-response";
import { prisma } from "@/lib/prisma";
import { parseJsonBody, personInputSchema } from "@/lib/validation";

export async function GET() {
  const people = await prisma.person.findMany({ orderBy: { sortOrder: "asc" } });
  return NextResponse.json({ data: people });
}

export async function POST(request: NextRequest) {
  try {
    const input = parseJsonBody(personInputSchema, await request.json());
    const person = await prisma.person.create({ data: input });
    return NextResponse.json({ data: person }, { status: 201 });
  } catch (error) {
    return apiError(error);
  }
}
