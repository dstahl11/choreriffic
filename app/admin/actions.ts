"use server";

import { compare } from "bcryptjs";
import { OccurrenceStatus, TimeOfDay } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createAdminSession, clearAdminSession, isAdminAuthenticated } from "@/lib/admin-auth";
import { createChore, deleteChorePermanently, updateChore } from "@/lib/chore-service";
import { prisma } from "@/lib/prisma";
import { choreInputSchema, personInputSchema } from "@/lib/validation";

export type LoginState = { error: string };

async function requireAdminAction() {
  if (!(await isAdminAuthenticated())) redirect("/admin/login");
}

function text(formData: FormData, name: string) {
  return String(formData.get(name) ?? "").trim();
}

function nullableText(formData: FormData, name: string) {
  const value = text(formData, name);
  return value || null;
}

export async function loginAction(_state: LoginState, formData: FormData): Promise<LoginState> {
  const password = text(formData, "password");
  const hash = process.env.ADMIN_PASSWORD_HASH;
  if (!hash) return { error: "Admin access is not configured yet." };
  const valid = password.length > 0 && (await compare(password, hash));
  if (!valid) return { error: "That password did not match. Try again." };
  await createAdminSession();
  redirect("/admin");
}

export async function logoutAction() {
  await clearAdminSession();
  redirect("/admin/login");
}

export async function savePersonAction(formData: FormData) {
  await requireAdminAction();
  const input = personInputSchema.parse({
    name: text(formData, "name"),
    color: text(formData, "color"),
    sortOrder: Number(text(formData, "sortOrder")),
    todoistLabel: nullableText(formData, "todoistLabel"),
  });
  const id = text(formData, "id");
  if (id) {
    await prisma.person.update({ where: { id }, data: input });
  } else {
    await prisma.person.create({ data: input });
  }
  revalidatePath("/admin");
  revalidatePath("/");
}

export async function saveChoreAction(formData: FormData) {
  await requireAdminAction();
  const input = choreInputSchema.parse({
    title: text(formData, "title"),
    description: nullableText(formData, "description"),
    active: formData.get("active") !== "false",
    rrule: text(formData, "rrule"),
    dtstart: text(formData, "dtstart"),
    rotation: formData.get("rotation") === "on",
    timeOfDay: nullableText(formData, "timeOfDay") as TimeOfDay | null,
    assigneeIds: formData.getAll("assigneeIds").map(String),
  });
  const id = text(formData, "id");
  if (id) await updateChore(prisma, id, input);
  else await createChore(prisma, input);
  revalidatePath("/admin");
  revalidatePath("/");
}

export async function deactivateChoreAction(formData: FormData) {
  await requireAdminAction();
  await prisma.chore.update({ where: { id: text(formData, "id") }, data: { active: false } });
  revalidatePath("/admin");
  revalidatePath("/");
}

export type DeleteChoreState = { error: string };

export async function deleteChoreAction(
  _state: DeleteChoreState,
  formData: FormData,
): Promise<DeleteChoreState> {
  await requireAdminAction();
  const id = text(formData, "id");
  if (!id) return { error: "This chore could not be identified. Refresh the page and try again." };

  try {
    const result = await deleteChorePermanently(prisma, id);
    if (!result.deleted) {
      if (result.reason === "has_completed_history") {
        return {
          error: "This chore has completed check-offs and cannot be deleted. Deactivate it instead to preserve your reports.",
        };
      }
      return { error: "This chore was already deleted. Refresh the page to update the list." };
    }
  } catch {
    return { error: "The chore could not be deleted. Try again." };
  }

  revalidatePath("/admin");
  revalidatePath("/");
  return { error: "" };
}

export async function reassignOccurrenceAction(formData: FormData) {
  await requireAdminAction();
  await prisma.occurrence.update({
    where: { id: text(formData, "id") },
    data: { personId: text(formData, "personId") },
  });
  revalidatePath("/admin");
  revalidatePath("/");
}

export async function setOccurrenceStatusAction(formData: FormData) {
  await requireAdminAction();
  const id = text(formData, "id");
  const status = text(formData, "status") as OccurrenceStatus;
  if (!Object.values(OccurrenceStatus).includes(status)) throw new Error("Invalid status.");
  const existing = await prisma.occurrence.findUniqueOrThrow({ where: { id } });
  await prisma.occurrence.update({
    where: { id },
    data: {
      status,
      completedAt:
        status === OccurrenceStatus.done
          ? existing.completedAt ?? new Date()
          : null,
    },
  });
  revalidatePath("/admin");
  revalidatePath("/");
}
