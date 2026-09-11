"use server";

import { compare } from "bcryptjs";
import { CalendarRange, CalendarSourceKind, OccurrenceStatus, TimeOfDay } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createAdminSession, clearAdminSession, isAdminAuthenticated } from "@/lib/admin-auth";
import { createChore, deleteChorePermanently, updateChore } from "@/lib/chore-service";
import { prisma } from "@/lib/prisma";
import {
  calendarSourceInputSchema,
  choreInputSchema,
  kioskSettingsInputSchema,
  personInputSchema,
} from "@/lib/validation";
import { assertSafeCalendarUrl } from "@/lib/calendar/ics";
import { clearCalendarSourceCache, syncCalendarSource } from "@/lib/calendar/service";
import { updateKioskSettings } from "@/lib/calendar/settings";
import { addCalendarDays, formatCalendarDate, todayInAppTimeZone } from "@/lib/date";

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

export async function saveCalendarSourceAction(formData: FormData) {
  await requireAdminAction();
  const id = text(formData, "id");
  const kind = text(formData, "kind") as CalendarSourceKind;
  let icsUrl = nullableText(formData, "icsUrl");
  if (kind === CalendarSourceKind.ics && id && !icsUrl) {
    const existing = await prisma.calendarSource.findUniqueOrThrow({ where: { id } });
    icsUrl = existing.icsUrl;
  }
  const input = calendarSourceInputSchema.parse({
    kind,
    name: text(formData, "name"),
    color: text(formData, "color"),
    enabled: formData.get("enabled") === "on",
    sortOrder: Number(text(formData, "sortOrder")),
    showLocation: formData.get("showLocation") === "on",
    googleCalendarId: kind === CalendarSourceKind.google ? nullableText(formData, "googleCalendarId") : null,
    icsUrl: kind === CalendarSourceKind.ics ? icsUrl : null,
  });
  if (input.kind === "ics") await assertSafeCalendarUrl(input.icsUrl);
  if (id) await prisma.calendarSource.update({ where: { id }, data: input });
  else await prisma.calendarSource.create({ data: input });
  if (id) clearCalendarSourceCache(id);
  revalidatePath("/admin");
  revalidatePath("/");
}

export async function deleteCalendarSourceAction(formData: FormData) {
  await requireAdminAction();
  const id = text(formData, "id");
  if (!id) throw new Error("Calendar source is missing.");
  await prisma.calendarSource.delete({ where: { id } });
  clearCalendarSourceCache(id);
  revalidatePath("/admin");
  revalidatePath("/");
}

export type CalendarSyncState = { error: string; success: string };

export async function syncCalendarSourceAction(
  _state: CalendarSyncState,
  formData: FormData,
): Promise<CalendarSyncState> {
  await requireAdminAction();
  const id = text(formData, "id");
  if (!id) return { error: "Calendar source is missing.", success: "" };
  const today = todayInAppTimeZone();
  try {
    const result = await syncCalendarSource(prisma, id, {
      from: formatCalendarDate(today),
      to: formatCalendarDate(addCalendarDays(today, 7)),
    });
    revalidatePath("/admin");
    revalidatePath("/");
    if (result.error) return { error: result.error, success: "" };
    return { error: "", success: `Synced ${result.events.length} event${result.events.length === 1 ? "" : "s"}.` };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Calendar sync failed.", success: "" };
  }
}

export async function saveKioskSettingsAction(formData: FormData) {
  await requireAdminAction();
  const input = kioskSettingsInputSchema.parse({
    rotationEnabled: formData.get("rotationEnabled") === "on",
    rotationChoresSeconds: Number(text(formData, "rotationChoresSeconds")),
    rotationCalendarSeconds: Number(text(formData, "rotationCalendarSeconds")),
    rotationCalendarRange: text(formData, "rotationCalendarRange") as CalendarRange,
    calendarDefaultRange: text(formData, "calendarDefaultRange") as CalendarRange,
  });
  await updateKioskSettings(prisma, input);
  revalidatePath("/admin");
  revalidatePath("/");
}
