"use client";

import {
  type Dispatch,
  type SetStateAction,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";

export const BOARD_POLL_MS = 30_000;
export const BOARD_MAX_BACKOFF_MS = 5 * 60_000;

export function boardPollDelay(failures: number, jitter = Math.random() * 1_000) {
  const base =
    failures === 0
      ? BOARD_POLL_MS
      : Math.min(BOARD_POLL_MS * 2 ** failures, BOARD_MAX_BACKOFF_MS);
  return base + Math.max(0, Math.min(jitter, 1_000));
}

type BoardDataState<T> = {
  data: T | null;
  error: string;
  lastSuccess: number | null;
  loading: boolean;
  refetchNow: () => void;
  setData: Dispatch<SetStateAction<T | null>>;
};

export function useBoardData<T>(url: string): BoardDataState<T> {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState("");
  const [lastSuccess, setLastSuccess] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const controller = useRef<AbortController | null>(null);
  const failures = useRef(0);
  const hasData = useRef(false);
  const mounted = useRef(false);
  const requestSequence = useRef(0);
  const urlRef = useRef(url);
  const tickRef = useRef<() => void>(() => undefined);
  urlRef.current = url;

  const tick = useCallback(async () => {
    if (timer.current) clearTimeout(timer.current);
    controller.current?.abort();

    const sequence = ++requestSequence.current;
    const requestController = new AbortController();
    controller.current = requestController;
    if (!hasData.current) setLoading(true);

    try {
      const response = await fetch(urlRef.current, {
        cache: "no-store",
        signal: requestController.signal,
      });
      if (!response.ok) throw new Error(`Server returned ${response.status}.`);

      const body = (await response.json()) as { data?: T };
      if (body.data === undefined) throw new Error("The board response was incomplete.");
      if (!mounted.current || sequence !== requestSequence.current) return;

      setData(body.data);
      hasData.current = true;
      setLastSuccess(Date.now());
      setError("");
      failures.current = 0;
    } catch (requestError) {
      if (
        !mounted.current ||
        sequence !== requestSequence.current ||
        requestController.signal.aborted
      ) {
        return;
      }
      failures.current += 1;
      const detail = requestError instanceof Error ? ` ${requestError.message}` : "";
      setError(`The board is offline.${detail} Retrying automatically.`);
    } finally {
      if (!mounted.current || sequence !== requestSequence.current) return;
      setLoading(false);
      timer.current = setTimeout(
        () => tickRef.current(),
        boardPollDelay(failures.current),
      );
    }
  }, []);
  tickRef.current = () => void tick();

  const refetchNow = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    failures.current = 0;
    controller.current?.abort();
    tickRef.current();
  }, []);

  useEffect(() => {
    mounted.current = true;
    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") refetchNow();
    };
    const onOnline = () => refetchNow();

    document.addEventListener("visibilitychange", onVisibilityChange);
    window.addEventListener("online", onOnline);
    return () => {
      mounted.current = false;
      requestSequence.current += 1;
      if (timer.current) clearTimeout(timer.current);
      controller.current?.abort();
      document.removeEventListener("visibilitychange", onVisibilityChange);
      window.removeEventListener("online", onOnline);
    };
  }, [refetchNow]);

  useEffect(() => {
    refetchNow();
  }, [url, refetchNow]);

  return { data, error, lastSuccess, loading, refetchNow, setData };
}
