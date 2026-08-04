import { RRule } from "rrule";
import { z } from "zod";
import { parseCalendarDate } from "@/lib/date";

export const timeOfDaySchema = z.enum(["morning", "afternoon", "evening", "anytime"]);
export const occurrenceStatusSchema = z.enum(["pending", "done", "skipped"]);

const colorSchema = z
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

export function parseJsonBody<T>(schema: z.ZodType<T>, value: unknown): T {
  return schema.parse(value);
}
