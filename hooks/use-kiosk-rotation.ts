"use client";

import { useEffect, useRef } from "react";
import { nextRotationStep, type RotationStep } from "@/lib/rotation";

export function useKioskRotation({
  enabled,
  schedule,
  idleMs,
  onShow,
}: {
  enabled: boolean;
  schedule: RotationStep[];
  idleMs: number;
  onShow: (view: RotationStep["view"]) => void;
}) {
  const onShowRef = useRef(onShow);
  onShowRef.current = onShow;
  const scheduleKey = schedule.map((step) => `${step.view}:${step.dwellMs}`).join("|");

  useEffect(() => {
    let rotationTimer = 0;
    let idleTimer = 0;
    let index = 0;
    let paused = false;

    const clear = () => {
      window.clearTimeout(rotationTimer);
      window.clearTimeout(idleTimer);
    };
    const armRotation = () => {
      window.clearTimeout(rotationTimer);
      if (!enabled || !schedule.length || paused || document.visibilityState !== "visible") return;
      rotationTimer = window.setTimeout(() => {
        index = nextRotationStep(schedule, index);
        onShowRef.current(schedule[index].view);
        armRotation();
      }, schedule[index].dwellMs);
    };
    const startFromToday = () => {
      index = 0;
      paused = false;
      onShowRef.current("today");
      armRotation();
    };
    const armIdleOnly = () => {
      paused = true;
      window.clearTimeout(idleTimer);
      idleTimer = window.setTimeout(() => onShowRef.current("today"), idleMs);
    };
    const interact = () => {
      paused = true;
      window.clearTimeout(rotationTimer);
      window.clearTimeout(idleTimer);
      idleTimer = window.setTimeout(startFromToday, idleMs);
    };
    const visibility = () => {
      if (document.visibilityState !== "visible") {
        clear();
        paused = true;
      } else {
        if (enabled && schedule.length) startFromToday();
        else armIdleOnly();
      }
    };
    const events = ["pointerdown", "keydown"] as const;
    events.forEach((event) => window.addEventListener(event, interact, { passive: true }));
    document.addEventListener("visibilitychange", visibility);
    if (enabled && schedule.length) startFromToday();
    else armIdleOnly();
    return () => {
      clear();
      events.forEach((event) => window.removeEventListener(event, interact));
      document.removeEventListener("visibilitychange", visibility);
    };
  }, [enabled, idleMs, scheduleKey]);
}
