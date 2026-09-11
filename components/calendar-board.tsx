"use client";

import { addDays, format, parseISO, startOfWeek } from "date-fns";
import { type CSSProperties, useMemo } from "react";
import { useBoardData } from "@/hooks/use-board-data";
import type { CalendarRange, KioskCalendarEvent, KioskCalendarPayload } from "@/types/kiosk";

type WeekStart = "monday" | "sunday";

function dateString(date: Date) {
  return format(date, "yyyy-MM-dd");
}

function weekStart(today: string, weekStartsOn: WeekStart, offset: number) {
  return addDays(startOfWeek(parseISO(today), {
    weekStartsOn: weekStartsOn === "sunday" ? 0 : 1,
  }), offset * 7);
}

function weekLabel(start: Date) {
  const end = addDays(start, 6);
  return start.getMonth() === end.getMonth()
    ? `${format(start, "MMM d")} – ${format(end, "d")}`
    : `${format(start, "MMM d")} – ${format(end, "MMM d")}`;
}

function time(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

function eventStyle(event: KioskCalendarEvent) {
  return { "--event-color": event.color } as CSSProperties;
}

function DayAgenda({ events, day, today, now }: {
  events: KioskCalendarEvent[]; day: string; today: string; now: number;
}) {
  const allDay = events.filter((event) => event.allDay);
  const timed = events.filter((event) => !event.allDay);
  const markerIndex = day === today
    ? timed.findIndex((event) => new Date(event.end).getTime() > now)
    : -1;
  return (
    <div className="calendar-agenda">
      {allDay.length ? (
        <ul className="calendar-all-day" aria-label="All-day events">
          {allDay.map((event) => (
            <li style={eventStyle(event)} key={event.id}><span aria-hidden="true" />{event.title}</li>
          ))}
        </ul>
      ) : null}
      <ol className="calendar-timed-list">
        {timed.map((event, index) => (
          <li key={event.id}>
            {index === markerIndex ? <div className="calendar-now-marker"><span>now</span></div> : null}
            <article
              className="calendar-event-row"
              data-past={day === today && new Date(event.end).getTime() <= now}
              style={eventStyle(event)}
            >
              <time><strong>{time(event.start)}</strong><small>{time(event.end)}</small></time>
              <div><h3>{event.title}</h3><p>{event.sourceName}{event.location ? ` · ${event.location}` : ""}</p></div>
            </article>
          </li>
        ))}
        {day === today && timed.length > 0 && markerIndex === -1 ? (
          <li><div className="calendar-now-marker"><span>now</span></div></li>
        ) : null}
      </ol>
      {!events.length ? <p className="nothing-today">Nothing on the calendar today.</p> : null}
    </div>
  );
}

export function CalendarBoard({
  today,
  range,
  offset,
  weekStartsOn,
  now,
  onRangeChange,
  onOffsetChange,
}: {
  today: string;
  range: CalendarRange;
  offset: number;
  weekStartsOn: WeekStart;
  now: number;
  onRangeChange: (range: CalendarRange) => void;
  onOffsetChange: (offset: number) => void;
}) {
  const start = range === "day"
    ? addDays(parseISO(today), offset)
    : weekStart(today, weekStartsOn, offset);
  const days = useMemo(
    () => Array.from({ length: range === "day" ? 1 : 7 }, (_, index) => addDays(start, index)),
    [range, start.getTime()],
  );
  const from = dateString(days[0]);
  const to = dateString(days[days.length - 1]);
  const { data, error, loading } = useBoardData<KioskCalendarPayload>(
    `/kiosk/calendar?from=${from}&to=${to}`,
  );
  const payload = data ?? { range: { from, to }, events: [], sources: [] };
  const stale = payload.sources.some((source) => source.stale);
  const setRange = (next: CalendarRange) => {
    onOffsetChange(0);
    onRangeChange(next);
  };

  return (
    <section className="calendar-board" aria-label={range === "day" ? `Calendar for ${from}` : `Calendar for ${weekLabel(start)}`}>
      <div className="calendar-toolbar">
        <div className="week-pager calendar-pager">
          <button type="button" aria-label={`Previous ${range}`} onClick={() => onOffsetChange(offset - 1)}>‹</button>
          <button className="calendar-jump-today" type="button" onClick={() => onOffsetChange(0)}>
            {range === "day" ? format(start, "EEEE, MMM d") : weekLabel(start)}
          </button>
          <button type="button" aria-label={`Next ${range}`} onClick={() => onOffsetChange(offset + 1)}>›</button>
        </div>
        <div className="calendar-range-switcher" aria-label="Calendar range">
          <button type="button" aria-pressed={range === "day"} onClick={() => setRange("day")}>Day</button>
          <button type="button" aria-pressed={range === "week"} onClick={() => setRange("week")}>Week</button>
        </div>
        {stale ? <p className="calendar-stale">Calendar may be out of date</p> : null}
      </div>
      {error ? <p className="error-message calendar-error">{error}</p> : null}
      {loading && !data ? <div className="kiosk-loading">Loading calendars…</div> : range === "day" ? (
        <DayAgenda events={payload.events.filter((event) => event.days.includes(from))} day={from} today={today} now={now} />
      ) : (
        <div className="week-grid calendar-week-grid">
          {days.map((day) => {
            const date = dateString(day);
            const events = payload.events.filter((event) => event.days.includes(date));
            return (
              <article className="day-column calendar-day-column" data-today={date === today} key={date}>
                <header><span>{format(day, "EEE")}</span><strong>{format(day, "d")}</strong></header>
                <ul className="calendar-week-events">
                  {events.map((event) => (
                    <li className="calendar-week-chip" data-all-day={event.allDay} style={eventStyle(event)} key={`${event.id}:${date}`}>
                      {!event.allDay ? <time>{time(event.start)}</time> : <small>All day</small>}
                      <strong>{event.title}</strong>
                    </li>
                  ))}
                  {!events.length ? <li className="calendar-no-events">No events</li> : null}
                </ul>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
