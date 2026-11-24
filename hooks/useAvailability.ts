"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { ApiError, AvailabilityResponse } from "@/types";

export type LoadError =
  | { kind: "unauthorized" }
  | { kind: "network" }
  | { kind: "server"; message: string; retryable: boolean };

interface State {
  /** Last successful data for the current date (kept while refreshing or after a failed refresh). */
  data: AvailabilityResponse | null;
  loading: boolean;
  error: LoadError | null;
}

/**
 * Fetch availability for `date`. Responses for a date that is no longer selected are ignored,
 * and the previous request is aborted when the date changes (§12.6).
 */
export function useAvailability(date: string, accessKey: string | null, onUnauthorized: () => void) {
  const [state, setState] = useState<State>({ data: null, loading: false, error: null });
  const cacheRef = useRef(new Map<string, AvailabilityResponse>());
  const controllerRef = useRef<AbortController | null>(null);
  const dateRef = useRef(date);
  dateRef.current = date;
  const unauthorizedRef = useRef(onUnauthorized);
  unauthorizedRef.current = onUnauthorized;

  const load = useCallback(
    async (refresh: boolean) => {
      if (!accessKey) return;
      controllerRef.current?.abort();
      const controller = new AbortController();
      controllerRef.current = controller;
      const requestedDate = date;

      setState((s) => ({ ...s, loading: true, error: null }));
      try {
        const res = await fetch(`/api/availability?date=${requestedDate}${refresh ? "&refresh=true" : ""}`, {
          headers: { Authorization: `Bearer ${accessKey}` },
          signal: controller.signal,
          cache: "no-store",
        });
        if (dateRef.current !== requestedDate) return;
        if (res.status === 401) {
          setState((s) => ({ ...s, loading: false, error: { kind: "unauthorized" } }));
          unauthorizedRef.current();
          return;
        }
        if (!res.ok) {
          const body = (await res.json().catch(() => null)) as ApiError | null;
          setState((s) => ({
            ...s,
            loading: false,
            error: {
              kind: "server",
              message: body?.error.message ?? `Request failed (${res.status}).`,
              retryable: body?.error.retryable ?? true,
            },
          }));
          return;
        }
        const data = (await res.json()) as AvailabilityResponse;
        if (dateRef.current !== requestedDate || data.date !== requestedDate) return;
        cacheRef.current.set(requestedDate, data);
        setState({ data, loading: false, error: null });
      } catch (err) {
        if ((err as Error).name === "AbortError" || dateRef.current !== requestedDate) return;
        setState((s) => ({ ...s, loading: false, error: { kind: "network" } }));
      }
    },
    [accessKey, date],
  );

  // New date (or key): show what we already have for that date, then fetch.
  useEffect(() => {
    setState({ data: cacheRef.current.get(date) ?? null, loading: false, error: null });
    void load(false);
    return () => controllerRef.current?.abort();
  }, [date, load]);

  const refresh = useCallback(() => load(true), [load]);

  return { ...state, refresh };
}
