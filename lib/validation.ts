import { RRule } from "rrule";
import { z } from "zod";
import { parseCalendarDate } from "@/lib/date";

export const timeOfDaySchema = z.enum(["morning", "afternoon", "evening", "anytime"]);
export const occurrenceStatusSchema = z.enum(["pending", "done", "skipped"]);

export const colorSchema = z
  .string()
  .regex(/^#[0-9a-fA-F]{6}$/, "Color must be a six-digit hex value.");

export const personInputSchema = z.object({
  name: z.string().trim().min(1).max(80),
  color: colorSchema,
  sortOrder: z.number().int().min(0).max(9999),
  todoistLabel: z.string().trim().max(120).nullable().optional(),
});

export const personPatchSchema = personInputSchema.partial();

const rruleSchema = z.string().trim().min(1).superRefine((value, context) => {
  try {
    RRule.parseString(value);
  } catch {
    context.addIssue({ code: "custom", message: "RRULE must be a valid RFC 5545 rule." });
  }
});

const dateStringSchema = z.string().refine(
  (value) => {
    try {
      parseCalendarDate(value);
      return true;
    } catch {
      return false;
    }
  },
  { message: "Date must use YYYY-MM-DD." },
);

export const choreInputSchema = z.object({
  title: z.string().trim().min(1).max(160),
  description: z.string().trim().max(2000).nullable().optional(),
  active: z.boolean().optional().default(true),
  rrule: rruleSchema,
  dtstart: dateStringSchema,
  rotation: z.boolean().optional().default(false),
  timeOfDay: timeOfDaySchema.nullable().optional(),
  assigneeIds: z.array(z.string().min(1)).min(1),
});

export const chorePatchSchema = choreInputSchema.partial();

export const calendarRangeSchema = z.enum(["day", "week"]);

export function normalizeCalendarUrl(value: string) {
  const trimmed = value.trim();
  return trimmed.toLowerCase().startsWith("webcal://")
    ? `https://${trimmed.slice("webcal://".length)}`
    : trimmed;
}

const calendarUrlSchema = z.string().transform(normalizeCalendarUrl).pipe(
  z.url({ protocol: /^https?$/ }),
);

const calendarSourceBase = {
  name: z.string().trim().min(1).max(80),
  color: colorSchema,
  enabled: z.boolean(),
  sortOrder: z.number().int().min(0).max(9999),
  showLocation: z.boolean(),
};

export const calendarSourceInputSchema = z.discriminatedUnion("kind", [
  z.object({
    ...calendarSourceBase,
    kind: z.literal("google"),
    googleCalendarId: z.string().trim().min(1).max(200).refine(
      (value) => value === "primary" || value.includes("@"),
      "Enter a Google calendar ID containing @, or primary.",
    ),
    icsUrl: z.null(),
  }),
  z.object({
    ...calendarSourceBase,
    kind: z.literal("ics"),
    googleCalendarId: z.null(),
    icsUrl: calendarUrlSchema,
  }),
]);

export const kioskSettingsInputSchema = z.object({
  rotationEnabled: z.boolean(),
  rotationChoresSeconds: z.number().int().min(15).max(3600),
  rotationCalendarSeconds: z.number().int().min(15).max(3600),
  rotationCalendarRange: calendarRangeSchema,
  calendarDefaultRange: calendarRangeSchema,
});

export function parseJsonBody<T>(schema: z.ZodType<T>, value: unknown): T {
  return schema.parse(value);
}
