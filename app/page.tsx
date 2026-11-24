"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AccessKeyPrompt } from "@/components/AccessKeyPrompt";
import { AvailabilityHeader } from "@/components/AvailabilityHeader";
import { AvailabilityMatrix, MatrixSkeleton } from "@/components/AvailabilityMatrix";
import { DateSelector } from "@/components/DateSelector";
import { ErrorMessage } from "@/components/ErrorMessage";
import { Header } from "@/components/Header";
import { OfflineNotice } from "@/components/OfflineNotice";
import { ServiceWorkerRegister } from "@/components/ServiceWorkerRegister";
import { StatusLegend } from "@/components/StatusLegend";
import { TimeRangeSelector } from "@/components/TimeRangeSelector";
import { useAccessKey } from "@/hooks/useAccessKey";
import { useAvailability } from "@/hooks/useAvailability";
import { useNow, useOnlineStatus } from "@/hooks/useOnlineStatus";
import { usePreferences } from "@/hooks/usePreferences";
import { buildMatrix, clampRange, freshness, openingRange } from "@/lib/matrix";
import { melbourneNow } from "@/lib/time";
import { dateBounds } from "@/lib/validation";

export default function Home() {
  const nowMs = useNow(15_000);
  const online = useOnlineStatus();
  const accessKey = useAccessKey();
  const { prefs, loaded: prefsLoaded, update: updatePrefs } = usePreferences();
  const [keyRejected, setKeyRejected] = useState(false);

  const melb = melbourneNow(new Date(nowMs));
  const today = melb.date;
  const bounds = dateBounds(new Date(nowMs));
  // Always opens on today's Melbourne date; the date is never persisted.
  const [date, setDate] = useState(today);

  // Midnight rollover while the app stays open.
  useEffect(() => {
    if (date < bounds.min) setDate(bounds.min);
  }, [date, bounds.min]);

  const onUnauthorized = useCallback(() => {
    accessKey.clear();
    setKeyRejected(true);
  }, [accessKey]);

  const { data, loading, error, refresh } = useAvailability(date, accessKey.key, onUnauthorized);

  const { open, close } = openingRange(data);
  const { startTime, endTime } = clampRange(prefs.startTime, prefs.endTime, open, close);

  const fresh = freshness(data?.updatedAt ?? null, nowMs, online);
  const nowMinutes = date === today ? melb.minutes : null;
  const rows = useMemo(
    () => (data ? buildMatrix(data, startTime, endTime, nowMinutes) : []),
    [data, startTime, endTime, nowMinutes],
  );

  // Coming back from the background or from the booking page: refresh once if data is no longer fresh.
  const staleRef = useRef(fresh !== "fresh");
  staleRef.current = fresh !== "fresh";
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === "visible" && staleRef.current && navigator.onLine) void refresh();
    };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("pageshow", onVisible);
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("pageshow", onVisible);
    };
  }, [refresh]);

  const ready = accessKey.loaded && prefsLoaded;
  const needsKey = ready && !accessKey.key;
  const allFailed = !!data && data.facilities.every((f) => f.status === "failed");
  const noneFree = rows.length > 0 && rows.every((r) => r.free === 0) && !rows.some((r) => r.incomplete);

  let body: React.ReactNode;
  if (!ready) body = <MatrixSkeleton />;
  else if (needsKey) {
    body = (
      <AccessKeyPrompt
        invalid={keyRejected}
        onSubmit={(k) => {
          setKeyRejected(false);
          accessKey.save(k);
        }}
      />
    );
  } else if (!data && loading) body = <MatrixSkeleton />;
  else if (!data || allFailed) {
    body = (
      <ErrorMessage
        title="Unable to load availability"
        detail={
          !online
            ? "You're offline."
            : error?.kind === "server"
              ? error.message
              : "Couldn't reach Birdie. Check your connection."
        }
        onRetry={online ? () => void refresh() : undefined}
      />
    );
  } else {
    body = (
      <>
        <AvailabilityHeader
          updatedAt={data.updatedAt}
          nowMs={nowMs}
          freshness={fresh}
          refreshing={loading}
          partial={data.partial}
        />
        {error && !loading && <p className="mb-2 text-xs text-danger">Refresh failed. Showing the last loaded data.</p>}
        {rows.length > 0 && (
          <AvailabilityMatrix
            facilities={data.facilities.map((f) => f.facility)}
            rows={rows}
            clickable={fresh !== "expired"}
          />
        )}
        {noneFree && <p className="mt-3 text-sm text-muted">No available courts in this time range.</p>}
        <StatusLegend showUnknown={rows.some((r) => r.incomplete)} />
        <p className="mt-3 mb-6 text-xs text-muted">Tap an available slot to open that court&apos;s booking page for the day.</p>
      </>
    );
  }

  return (
    <main className="mx-auto max-w-2xl px-4">
      <ServiceWorkerRegister />
      <Header refreshing={loading} onRefresh={() => void refresh()} disabled={!accessKey.key || !online} />
      {!online && <OfflineNotice />}
      {/* The page is prerendered; date/time controls depend on the client clock and storage. */}
      {ready ? (
        <>
          <DateSelector date={date} min={bounds.min} max={bounds.max} today={today} onChange={setDate} />
          <TimeRangeSelector
            startTime={startTime}
            endTime={endTime}
            open={open}
            close={close}
            onChange={(s, e) => updatePrefs({ startTime: s, endTime: e })}
          />
        </>
      ) : (
        <div className="h-[130px]" aria-hidden />
      )}
      {body}
    </main>
  );
}
