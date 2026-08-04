"use client";

import { RRule } from "rrule";
import { useMemo, useState } from "react";
import { saveChoreAction } from "@/app/admin/actions";
import type { KioskPerson } from "@/types/kiosk";

type EditableChore = {
  id: string;
  title: string;
  description: string | null;
  active: boolean;
  rrule: string;
  dtstart: string;
  rotation: boolean;
  timeOfDay: string | null;
  assigneeIds: string[];
};

const WEEKDAYS = [
  ["MO", "Mon"], ["TU", "Tue"], ["WE", "Wed"], ["TH", "Thu"],
  ["FR", "Fri"], ["SA", "Sat"], ["SU", "Sun"],
] as const;

function parseRule(rule?: string) {
  const source = rule ?? "FREQ=WEEKLY;BYDAY=MO";
  const frequency = source.match(/FREQ=([^;]+)/)?.[1] ?? "WEEKLY";
  const interval = source.match(/INTERVAL=(\d+)/)?.[1] ?? "1";
  const byDay = source.match(/BYDAY=([^;]+)/)?.[1]?.split(",") ?? ["MO"];
  return { source, frequency, interval, byDay };
}

function previewDates(rrule: string, dtstart: string) {
  try {
    const [year, month, day] = dtstart.split("-").map(Number);
    const options = RRule.parseString(rrule);
    const rule = new RRule({ ...options, dtstart: new Date(Date.UTC(year, month - 1, day)) });
    return rule.all((_, index) => index < 5).slice(0, 5);
  } catch {
    return [];
  }
}

function currentCalendarDate() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

export function ChoreEditor({ people, chore }: { people: KioskPerson[]; chore?: EditableChore }) {
  const parsed = parseRule(chore?.rrule);
  const [frequency, setFrequency] = useState(parsed.frequency);
  const [interval, setInterval] = useState(parsed.interval);
  const [weekdays, setWeekdays] = useState<string[]>(parsed.byDay);
  const [rawMode, setRawMode] = useState(Boolean(chore));
  const [rawRule, setRawRule] = useState(parsed.source);
  const [dtstart, setDtstart] = useState(chore?.dtstart ?? currentCalendarDate());

  const generatedRule = useMemo(() => {
    const parts = [`FREQ=${frequency}`];
    if (Number(interval) > 1) parts.push(`INTERVAL=${interval}`);
    if (frequency === "WEEKLY" && weekdays.length) parts.push(`BYDAY=${weekdays.join(",")}`);
    return parts.join(";");
  }, [frequency, interval, weekdays]);
  const rule = rawMode ? rawRule : generatedRule;
  const preview = useMemo(() => previewDates(rule, dtstart), [rule, dtstart]);

  return (
    <form action={saveChoreAction} className="admin-form chore-editor">
      {chore ? <input type="hidden" name="id" value={chore.id} /> : null}
      <input type="hidden" name="active" value="true" />
      <input type="hidden" name="rrule" value={rule} />
      <div className="form-grid">
        <label>Chore title<input name="title" defaultValue={chore?.title} required maxLength={160} /></label>
        <label>Starts<input name="dtstart" type="date" value={dtstart} onChange={(event) => setDtstart(event.target.value)} required /></label>
        <label>Time of day
          <select name="timeOfDay" defaultValue={chore?.timeOfDay ?? "anytime"}>
            <option value="morning">Morning</option><option value="afternoon">Afternoon</option>
            <option value="evening">Evening</option><option value="anytime">Anytime</option>
          </select>
        </label>
        <label>Description<textarea name="description" defaultValue={chore?.description ?? ""} rows={2} /></label>
      </div>

      <fieldset className="builder-fieldset">
        <legend>Schedule</legend>
        <label className="toggle-row"><input type="checkbox" checked={rawMode} onChange={(event) => setRawMode(event.target.checked)} /> Edit raw RRULE</label>
        {rawMode ? (
          <label>RRULE<input value={rawRule} onChange={(event) => setRawRule(event.target.value.toUpperCase())} aria-describedby={`preview-${chore?.id ?? "new"}`} /></label>
        ) : (
          <div className="schedule-builder">
            <label>Frequency<select value={frequency} onChange={(event) => setFrequency(event.target.value)}><option value="DAILY">Daily</option><option value="WEEKLY">Weekly</option><option value="MONTHLY">Monthly</option></select></label>
            <label>Every<input type="number" min="1" max="52" value={interval} onChange={(event) => setInterval(event.target.value)} /></label>
            {frequency === "WEEKLY" ? <div className="weekday-options">{WEEKDAYS.map(([value, label]) => <label key={value}><input type="checkbox" checked={weekdays.includes(value)} onChange={(event) => setWeekdays((current) => event.target.checked ? [...current, value] : current.filter((day) => day !== value))} />{label}</label>)}</div> : null}
          </div>
        )}
        <p id={`preview-${chore?.id ?? "new"}`} className="rule-preview">
          {preview.length === 5 ? `Next five: ${preview.map((date) => new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", timeZone: "UTC" }).format(date)).join(" · ")}` : "Fix the rule to see its next five dates."}
        </p>
      </fieldset>

      <fieldset className="builder-fieldset">
        <legend>Assigned to</legend>
        <div className="person-options">
          {people.map((person) => <label key={person.id}><input name="assigneeIds" type="checkbox" value={person.id} defaultChecked={chore?.assigneeIds.includes(person.id)} /> <span className="person-dot" style={{ "--person-color": person.color } as React.CSSProperties} />{person.name}</label>)}
        </div>
        <label className="toggle-row"><input name="rotation" type="checkbox" defaultChecked={chore?.rotation} /> Rotate through selected people</label>
      </fieldset>

      <button type="submit" disabled={people.length === 0}>{chore ? "Save chore" : "Create chore"}</button>
    </form>
  );
}
