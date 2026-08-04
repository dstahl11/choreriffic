"use client";

import { type ReactNode, useEffect, useRef, useState } from "react";

const STALE_AFTER_MS = 3 * 60_000;

function localDayKey(timestamp: number) {
  const date = new Date(timestamp);
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

export function BoardHeader({
  boardDate,
  children,
  lastSuccess,
  onDateRollover,
}: {
  boardDate: string;
  children: ReactNode;
  lastSuccess: number | null;
  onDateRollover: () => void;
}) {
  const [now, setNow] = useState<number | null>(null);
  const previousDay = useRef<string | null>(null);

  useEffect(() => {
    setNow(Date.now());
    const interval = window.setInterval(() => setNow(Date.now()), 15_000);
    return () => window.clearInterval(interval);
  }, []);

  const dayKey = now === null ? null : localDayKey(now);
  useEffect(() => {
    if (!dayKey) return;
    if (previousDay.current === null) {
      previousDay.current = dayKey;
      if (dayKey !== boardDate) onDateRollover();
      return;
    }
    if (previousDay.current !== dayKey) {
      previousDay.current = dayKey;
      onDateRollover();
    }
  }, [boardDate, dayKey, onDateRollover]);

  if (now === null) {
    return (
      <header className="kiosk-header">
        <div aria-hidden="true" className="kiosk-date kiosk-date-placeholder" />
        {children}
      </header>
    );
  }

  const stale = lastSuccess === null || now - lastSuccess > STALE_AFTER_MS;
  const date = new Date(now);
  const weekday = date.toLocaleDateString(undefined, { weekday: "long" });
  const dateLabel = date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
  const timeLabel = date.toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  });

  return (
    <header className="kiosk-header" data-stale={stale}>
      <div className="kiosk-date" aria-live="off">
        <h1>{weekday}</h1>
        <p>
          {dateLabel} · {timeLabel}
          {stale ? <strong className="offline-marker"> · offline</strong> : null}
        </p>
      </div>
      {children}
    </header>
  );
}
