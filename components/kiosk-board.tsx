"use client";

import { addDays, format, parseISO, startOfWeek } from "date-fns";
import { useRouter } from "next/navigation";
import {
  type CSSProperties,
  useCallback,
  useMemo,
  useRef,
  useState,
} from "react";
import { BoardHeader } from "@/components/board-header";
import { CalendarBoard } from "@/components/calendar-board";
import { useBoardData } from "@/hooks/use-board-data";
import { useKioskRotation } from "@/hooks/use-kiosk-rotation";
import { rotationSchedule } from "@/lib/rotation";
import type {
  CalendarRange,
  KioskOccurrence,
  KioskPayload,
  KioskPerson,
  KioskSettings,
} from "@/types/kiosk";

type View = "today" | "week" | "calendar";
type WeekStart = "monday" | "sunday";

const TIME_ORDER = { morning: 0, afternoon: 1, evening: 2, anytime: 3 } as const;
const TIME_LABELS = {
  morning: "☀️ morning",
  afternoon: "⛅ afternoon",
  evening: "🌙 evening",
  anytime: "✨ anytime",
} as const;

function dateToString(date: Date) {
  return format(date, "yyyy-MM-dd");
}

function currentCalendarDate() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/New_York",
    year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(new Date());
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

function getWeekStart(today: string, weekStartsOn: WeekStart, offset: number) {
  const start = startOfWeek(parseISO(today), {
    weekStartsOn: weekStartsOn === "sunday" ? 0 : 1,
  });
  return addDays(start, offset * 7);
}

function weekRangeLabel(start: Date) {
  const end = addDays(start, 6);
  return start.getMonth() === end.getMonth()
    ? `${format(start, "MMM d")} – ${format(end, "d")}`
    : `${format(start, "MMM d")} – ${format(end, "MMM d")}`;
}

function PersonHeader({ person, items }: { person: KioskPerson; items: KioskOccurrence[] }) {
  const done = items.filter((item) => item.status === "done").length;
  return (
    <header className="person-header">
      <div className="avatar" aria-hidden="true">
        {person.name.slice(0, 1).toUpperCase()}
      </div>
      <div className="person-heading-copy">
        <h2>{person.name}</h2>
        <p>{done} of {items.length} done{done === items.length && items.length ? " ★" : ""}</p>
      </div>
    </header>
  );
}

export function KioskBoard({
  initialToday,
  initialView,
  initialCalendarRange,
  initialSettings,
  weekStartsOn,
  confirmTap,
}: {
  initialToday: string;
  initialView: View;
  initialCalendarRange: CalendarRange;
  initialSettings: KioskSettings;
  weekStartsOn: WeekStart;
  confirmTap: boolean;
}) {
  const router = useRouter();
  const [view, setView] = useState<View>(initialView);
  const [today, setToday] = useState(initialToday);
  const [weekOffset, setWeekOffset] = useState(0);
  const [calendarRange, setCalendarRange] = useState(initialCalendarRange);
  const [calendarOffset, setCalendarOffset] = useState(0);
  const [now, setNow] = useState(() => Date.now());
  const [actionError, setActionError] = useState("");
  const [armedId, setArmedId] = useState<string | null>(null);
  const armTimer = useRef<number | null>(null);

  const weekStart = useMemo(
    () => getWeekStart(today, weekStartsOn, weekOffset),
    [today, weekStartsOn, weekOffset],
  );
  const days = useMemo(
    () => Array.from({ length: 7 }, (_, index) => addDays(weekStart, index)),
    [weekStart],
  );
  const range = useMemo(
    () =>
      view === "week"
        ? { from: dateToString(days[0]), to: dateToString(days[6]) }
        : { from: today, to: today },
    [days, today, view],
  );

  const boardUrl = `/kiosk/data?from=${range.from}&to=${range.to}`;
  const {
    data,
    error: pollError,
    lastSuccess,
    loading,
    refetchNow,
    setData,
  } = useBoardData<KioskPayload>(boardUrl);
  const payload = data ?? { people: [], occurrences: [], settings: initialSettings };
  const settings = payload.settings;

  const handleDateRollover = useCallback(() => {
    const nextToday = currentCalendarDate();
    if (view === "week") {
      const nextWeekStart = getWeekStart(nextToday, weekStartsOn, weekOffset);
      const nextFrom = dateToString(nextWeekStart);
      const nextTo = dateToString(addDays(nextWeekStart, 6));
      if (nextFrom === range.from && nextTo === range.to) refetchNow();
    }
    if (view === "calendar" && calendarOffset === 0) setCalendarOffset(0);
    setToday(nextToday);
  }, [calendarOffset, range.from, range.to, refetchNow, view, weekOffset, weekStartsOn]);

  const showRotationView = useCallback((nextView: "today" | "calendar") => {
    setView(nextView);
    setWeekOffset(0);
    setCalendarOffset(0);
    if (nextView === "calendar") {
      setCalendarRange(settings.rotationCalendarRange);
      router.replace(`/?view=calendar&range=${settings.rotationCalendarRange}`, { scroll: false });
    } else {
      router.replace("/", { scroll: false });
    }
  }, [router, settings.rotationCalendarRange]);
  const schedule = useMemo(() => rotationSchedule(settings), [settings]);
  useKioskRotation({
    enabled: settings.rotationEnabled && settings.calendarEnabled,
    schedule,
    idleMs: 5 * 60_000,
    onShow: showRotationView,
  });

  const switchView = (nextView: View) => {
    setView(nextView);
    if (nextView === "today") setWeekOffset(0);
    if (nextView === "calendar") {
      setCalendarOffset(0);
      router.replace(`/?view=calendar&range=${calendarRange}`, { scroll: false });
    } else {
      router.replace(nextView === "week" ? "/?view=week" : "/", { scroll: false });
    }
  };

  const changeCalendarRange = (nextRange: CalendarRange) => {
    setCalendarRange(nextRange);
    router.replace(`/?view=calendar&range=${nextRange}`, { scroll: false });
  };

  const toggleOccurrence = async (occurrence: KioskOccurrence) => {
    const nextDone = occurrence.status !== "done";
    if (confirmTap && nextDone && armedId !== occurrence.id) {
      setArmedId(occurrence.id);
      if (armTimer.current) window.clearTimeout(armTimer.current);
      armTimer.current = window.setTimeout(() => setArmedId(null), 4_000);
      return;
    }
    setArmedId(null);
    const previousStatus = occurrence.status;
    const previousCompletedAt = occurrence.completedAt;
    setData((current) => current ? ({
      ...current,
      occurrences: current.occurrences.map((item) =>
        item.id === occurrence.id
          ? {
              ...item,
              status: nextDone ? "done" : "pending",
              completedAt: nextDone ? new Date().toISOString() : null,
            }
          : item,
      ),
    }) : current);
    try {
      const response = await fetch(`/kiosk/occurrences/${occurrence.id}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ done: nextDone }),
      });
      if (!response.ok) throw new Error("That check-off did not reach the database. Try again.");
      setActionError("");
    } catch (toggleError) {
      setData((current) => current ? ({
        ...current,
        occurrences: current.occurrences.map((item) =>
          item.id === occurrence.id
            ? { ...item, status: previousStatus, completedAt: previousCompletedAt }
            : item,
        ),
      }) : current);
      setActionError(toggleError instanceof Error ? toggleError.message : "That check-off was not saved.");
    }
  };

  const dateHeading = format(parseISO(today), "EEEE");
  const error = actionError || pollError;

  return (
    <main className="kiosk-shell board-root" data-view={view}>
      <BoardHeader boardDate={today} lastSuccess={lastSuccess} onDateRollover={handleDateRollover} onNowChange={setNow}>
        <nav className="view-switcher" aria-label="Board view">
          <button type="button" aria-pressed={view === "today"} onClick={() => switchView("today")}>Today</button>
          <button type="button" aria-pressed={view === "week"} onClick={() => switchView("week")}>Week</button>
          <button type="button" aria-pressed={view === "calendar"} onClick={() => switchView("calendar")}>Calendar</button>
        </nav>
      </BoardHeader>

      <div className="board-message" aria-live="polite">
        {error ? <p className="error-message">{error}</p> : null}
      </div>

      {view === "calendar" ? (
        <CalendarBoard
          today={today}
          range={calendarRange}
          offset={calendarOffset}
          weekStartsOn={weekStartsOn}
          now={now}
          onRangeChange={changeCalendarRange}
          onOffsetChange={setCalendarOffset}
        />
      ) : loading && payload.people.length === 0 ? (
        <div className="kiosk-loading">Loading the sticker board…</div>
      ) : payload.people.length === 0 ? (
        <section className="empty-board">
          <h2>The board is ready for your family.</h2>
          <p>Add people and chores in the protected admin area.</p>
          <a href="/admin">Open admin</a>
        </section>
      ) : view === "today" ? (
        <section
          className="today-grid"
          aria-label={`Chores for ${dateHeading}`}
          style={{ "--people-count": Math.min(payload.people.length, 6) } as CSSProperties}
        >
          {payload.people.map((person) => {
            const items = payload.occurrences
              .filter((item) => item.personId === person.id)
              .sort((left, right) => {
                if (left.status === "done" && right.status !== "done") return 1;
                if (right.status === "done" && left.status !== "done") return -1;
                return TIME_ORDER[left.chore.timeOfDay ?? "anytime"] - TIME_ORDER[right.chore.timeOfDay ?? "anytime"];
              });
            const pending = items.filter((item) => item.status !== "done");
            const done = items.filter((item) => item.status === "done");
            const personStyle = { "--person-color": person.color } as CSSProperties;
            return (
              <article className="person-column" style={personStyle} key={person.id}>
                <PersonHeader person={person} items={items} />
                <div className="chore-list">
                  {pending.map((item) => (
                    <button
                      className="chore-card"
                      data-state={armedId === item.id ? "armed" : "pending"}
                      type="button"
                      aria-pressed="false"
                      onClick={() => void toggleOccurrence(item)}
                      key={item.id}
                    >
                      <span className="check-circle" aria-hidden="true" />
                      <span className="chore-copy">
                        <strong>{item.chore.title}</strong>
                        <small>{armedId === item.id ? "tap again to finish! 👆" : TIME_LABELS[item.chore.timeOfDay ?? "anytime"]}</small>
                      </span>
                    </button>
                  ))}
                  {items.length === 0 ? <p className="nothing-today">Nothing today — all clear.</p> : null}
                  {pending.length === 0 && items.length > 0 ? <p className="all-done">All done! ★</p> : null}
                </div>
                {done.length ? (
                  <details className="done-section">
                    <summary>Done <span>{done.length}</span></summary>
                    <div className="done-list">
                      {done.map((item) => (
                        <button
                          className="chore-card"
                          data-state="done"
                          type="button"
                          aria-pressed="true"
                          onClick={() => void toggleOccurrence(item)}
                          key={item.id}
                        >
                          <span className="check-circle" aria-hidden="true">✓</span>
                          <span className="chore-copy"><strong>{item.chore.title}</strong><small>tap to undo</small></span>
                        </button>
                      ))}
                    </div>
                  </details>
                ) : null}
              </article>
            );
          })}
        </section>
      ) : (
        <section className="week-board" aria-label={`Week of ${weekRangeLabel(weekStart)}`}>
          <div className="week-pager">
            <button type="button" aria-label="Previous week" onClick={() => setWeekOffset((value) => value - 1)}>‹</button>
            <h2>{weekRangeLabel(weekStart)}</h2>
            <button type="button" aria-label="Next week" onClick={() => setWeekOffset((value) => value + 1)}>›</button>
          </div>
          <div className="week-grid">
            {days.map((day) => {
              const date = dateToString(day);
              const items = payload.occurrences.filter((item) => item.date === date);
              const isToday = date === today;
              return (
                <article className="day-column" data-today={isToday} key={date}>
                  <header><span>{format(day, "EEE")}</span><strong>{format(day, "d")}</strong></header>
                  <div className="day-chore-list">
                    {items.map((item) => (
                      <button
                        className="week-chip"
                        data-state={item.status === "done" ? "done" : "pending"}
                        type="button"
                        aria-pressed={item.status === "done"}
                        aria-label={`${item.status === "done" ? "Undo" : "Complete"} ${item.chore.title} for ${item.person.name}`}
                        onClick={() => void toggleOccurrence(item)}
                        style={{ "--person-color": item.person.color } as CSSProperties}
                        key={item.id}
                      >
                        <span className="week-assignee-badge" aria-hidden="true">
                          {item.person.name.trim().slice(0, 1).toUpperCase()}
                        </span>
                        <span className="week-chip-label">
                          {item.status === "done" ? "✓ " : ""}{item.chore.title}
                        </span>
                      </button>
                    ))}
                    {items.length === 0 ? <p>No chores</p> : null}
                  </div>
                </article>
              );
            })}
          </div>
        </section>
      )}
    </main>
  );
}
