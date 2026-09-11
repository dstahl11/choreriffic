"use client";

import type { CalendarSourceKind } from "@prisma/client";
import { useActionState, useState } from "react";
import {
  deleteCalendarSourceAction,
  saveCalendarSourceAction,
  syncCalendarSourceAction,
  type CalendarSyncState,
} from "@/app/admin/actions";

type EditableCalendarSource = {
  id: string;
  kind: CalendarSourceKind;
  name: string;
  color: string;
  enabled: boolean;
  sortOrder: number;
  googleCalendarId: string | null;
  icsUrlRedacted: string | null;
  showLocation: boolean;
  lastSyncedAt: string | null;
  lastError: string | null;
};

const initialSyncState: CalendarSyncState = { error: "", success: "" };

function relativeTime(value: string) {
  const seconds = Math.round((new Date(value).getTime() - Date.now()) / 1000);
  const formatter = new Intl.RelativeTimeFormat("en", { numeric: "auto" });
  if (Math.abs(seconds) < 60) return formatter.format(seconds, "second");
  const minutes = Math.round(seconds / 60);
  if (Math.abs(minutes) < 60) return formatter.format(minutes, "minute");
  const hours = Math.round(minutes / 60);
  if (Math.abs(hours) < 24) return formatter.format(hours, "hour");
  return formatter.format(Math.round(hours / 24), "day");
}

function SyncForm({ id }: { id: string }) {
  const [state, action, pending] = useActionState(syncCalendarSourceAction, initialSyncState);
  return (
    <form action={action} className="calendar-inline-action">
      <input name="id" type="hidden" value={id} />
      <button className="secondary-button" type="submit" disabled={pending}>{pending ? "Syncing…" : "Sync now"}</button>
      <p className={state.error ? "form-error" : "form-success"} aria-live="polite">{state.error || state.success}</p>
    </form>
  );
}

export function CalendarSourceEditor({
  source,
  defaultOrder,
}: {
  source?: EditableCalendarSource;
  defaultOrder?: number;
}) {
  const [kind, setKind] = useState<CalendarSourceKind>(source?.kind ?? "google");
  return (
    <div className="calendar-source-card">
      {source ? (
        <header className="calendar-source-heading">
          <span style={{ backgroundColor: source.color }} aria-hidden="true" />
          <strong>{source.name}</strong>
          <small>{source.kind === "google" ? "Google" : "ICS URL"}</small>
        </header>
      ) : null}
      <form action={saveCalendarSourceAction} className="admin-form calendar-source-form">
        {source ? <input name="id" type="hidden" value={source.id} /> : null}
        <div className="form-grid">
          <label>Type
            <select name="kind" value={kind} onChange={(event) => setKind(event.target.value as CalendarSourceKind)}>
              <option value="google">Google</option>
              <option value="ics">ICS URL</option>
            </select>
          </label>
          <label>Name<input name="name" defaultValue={source?.name} maxLength={80} required /></label>
          <label>Color<input name="color" type="color" defaultValue={source?.color ?? "#e48b2a"} required /></label>
          <label>Order<input name="sortOrder" type="number" min="0" max="9999" defaultValue={source?.sortOrder ?? defaultOrder ?? 0} required /></label>
        </div>
        {kind === "google" ? (
          <label>Google calendar ID<input name="googleCalendarId" defaultValue={source?.googleCalendarId ?? ""} placeholder="family@gmail.com" required /></label>
        ) : (
          <label>{source?.icsUrlRedacted ? `Replace ICS URL (currently ${source.icsUrlRedacted})` : "ICS URL"}
            <input name="icsUrl" type="url" placeholder={source ? "Leave blank to keep the current URL" : "https://…/calendar.ics"} required={!source} />
          </label>
        )}
        <div className="calendar-source-toggles">
          <label className="toggle-row"><input name="enabled" type="checkbox" defaultChecked={source?.enabled ?? true} /> Enabled</label>
          <label className="toggle-row"><input name="showLocation" type="checkbox" defaultChecked={source?.showLocation ?? true} /> Show locations</label>
        </div>
        {source?.lastSyncedAt ? <p className="calendar-source-status">Last synced <time dateTime={source.lastSyncedAt} title={new Date(source.lastSyncedAt).toLocaleString()}>{relativeTime(source.lastSyncedAt)}</time></p> : null}
        {source?.lastError ? <p className="form-error">{source.lastError}</p> : null}
        <button type="submit">{source ? "Save calendar" : "Add calendar"}</button>
      </form>
      {source ? (
        <div className="calendar-source-actions">
          <SyncForm id={source.id} />
          <form action={deleteCalendarSourceAction}>
            <input name="id" type="hidden" value={source.id} />
            <button className="danger-button" type="submit">Delete</button>
          </form>
        </div>
      ) : null}
    </div>
  );
}
