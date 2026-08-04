import { OccurrenceStatus } from "@prisma/client";
import { redirect } from "next/navigation";
import {
  deactivateChoreAction,
  logoutAction,
  reassignOccurrenceAction,
  savePersonAction,
  setOccurrenceStatusAction,
} from "@/app/admin/actions";
import { ChoreEditor } from "@/components/chore-editor";
import { DeleteChoreForm } from "@/components/delete-chore-form";
import { isAdminAuthenticated } from "@/lib/admin-auth";
import { choreInclude } from "@/lib/chore-service";
import {
  addCalendarDays,
  formatCalendarDate,
  todayInAppTimeZone,
} from "@/lib/date";
import { queryOccurrences } from "@/lib/occurrences";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  if (!(await isAdminAuthenticated())) redirect("/admin/login");
  const today = todayInAppTimeZone();
  const nextTwoWeeks = addCalendarDays(today, 14);
  const monthAgo = addCalendarDays(today, -30);
  const [people, chores, upcoming, completed] = await Promise.all([
    prisma.person.findMany({ orderBy: { sortOrder: "asc" } }),
    prisma.chore.findMany({ include: choreInclude, orderBy: [{ active: "desc" }, { title: "asc" }] }),
    queryOccurrences(prisma, { from: formatCalendarDate(today), to: formatCalendarDate(nextTwoWeeks) }),
    queryOccurrences(prisma, { from: formatCalendarDate(monthAgo), to: formatCalendarDate(today), status: OccurrenceStatus.done }),
  ]);

  const completedByPerson = people.map((person) => ({
    person,
    count: completed.filter((item) => item.personId === person.id).length,
  }));

  return (
    <main className="admin-shell">
      <header className="admin-header">
        <div><a className="back-link" href="/">← Sticker Board</a><h1>Household admin</h1><p>Schedules, people, overrides, and recent completion totals.</p></div>
        <form action={logoutAction}><button className="secondary-button" type="submit">Sign out</button></form>
      </header>

      <section className="admin-section" id="people">
        <div className="section-heading"><h2>People</h2><p>Color and order control the kiosk columns.</p></div>
        <div className="people-admin-grid">
          {people.map((person) => (
            <form action={savePersonAction} className="admin-form compact-form" key={person.id}>
              <input name="id" type="hidden" value={person.id} />
              <label>Name<input name="name" defaultValue={person.name} required /></label>
              <label>Color<input name="color" type="color" defaultValue={person.color} required /></label>
              <label>Order<input name="sortOrder" type="number" min="0" defaultValue={person.sortOrder} required /></label>
              <label>Todoist label<input name="todoistLabel" defaultValue={person.todoistLabel ?? ""} /></label>
              <button type="submit">Save person</button>
            </form>
          ))}
          <form action={savePersonAction} className="admin-form compact-form new-form">
            <h3>Add a person</h3>
            <label>Name<input name="name" required /></label>
            <label>Color<input name="color" type="color" defaultValue="#48b2ee" required /></label>
            <label>Order<input name="sortOrder" type="number" min="0" defaultValue={people.length} required /></label>
            <label>Todoist label<input name="todoistLabel" /></label>
            <button type="submit">Add person</button>
          </form>
        </div>
      </section>

      <section className="admin-section" id="chores">
        <div className="section-heading"><h2>Chores</h2><p>Rules materialize into date-specific, reportable occurrences.</p></div>
        <details className="admin-disclosure" open={chores.length === 0}><summary>Create a chore</summary><ChoreEditor people={people} /></details>
        <div className="chore-admin-list">
          {chores.map((chore) => (
            <details className="admin-disclosure" key={chore.id}>
              <summary><span>{chore.title}</span><small>{chore.active ? chore.rrule : "Inactive"}</small></summary>
              <ChoreEditor people={people} chore={{
                id: chore.id,
                title: chore.title,
                description: chore.description,
                active: chore.active,
                rrule: chore.rrule,
                dtstart: formatCalendarDate(chore.dtstart),
                rotation: chore.rotation,
                timeOfDay: chore.timeOfDay,
                assigneeIds: chore.assignees.map((assignee) => assignee.personId),
              }} />
              <div className="chore-admin-actions">
                {chore.active ? <form action={deactivateChoreAction} className="deactivate-form"><input name="id" type="hidden" value={chore.id} /><button className="danger-button" type="submit">Deactivate chore</button></form> : null}
                <DeleteChoreForm id={chore.id} title={chore.title} />
              </div>
            </details>
          ))}
        </div>
      </section>

      <section className="admin-section" id="overrides">
        <div className="section-heading"><h2>Upcoming overrides</h2><p>Reassign or skip one date without changing its rule.</p></div>
        <div className="occurrence-admin-list">
          {upcoming.map((occurrence) => (
            <article className="occurrence-row" key={occurrence.id}>
              <div><strong>{occurrence.chore.title}</strong><span>{formatCalendarDate(occurrence.date)} · {occurrence.person.name} · {occurrence.status}</span></div>
              <form action={reassignOccurrenceAction}>
                <input name="id" type="hidden" value={occurrence.id} />
                <label><span className="sr-only">Reassign {occurrence.chore.title}</span><select name="personId" defaultValue={occurrence.personId}>{people.map((person) => <option value={person.id} key={person.id}>{person.name}</option>)}</select></label>
                <button className="secondary-button" type="submit">Reassign</button>
              </form>
              <form action={setOccurrenceStatusAction}>
                <input name="id" type="hidden" value={occurrence.id} />
                <input name="status" type="hidden" value={occurrence.status === "skipped" ? "pending" : "skipped"} />
                <button className="secondary-button" type="submit">{occurrence.status === "skipped" ? "Unskip" : "Skip"}</button>
              </form>
            </article>
          ))}
        </div>
      </section>

      <section className="admin-section" id="reports">
        <div className="section-heading"><h2>Last 30 days</h2><p>The API can export the underlying completion rows for reporting.</p></div>
        <div className="report-strip">
          <div><strong>{completed.length}</strong><span>Total completed</span></div>
          {completedByPerson.map(({ person, count }) => <div key={person.id}><strong>{count}</strong><span>{person.name}</span></div>)}
        </div>
        <code>GET /api/reports/completions?from=YYYY-MM-DD&amp;to=YYYY-MM-DD</code>
      </section>
    </main>
  );
}
