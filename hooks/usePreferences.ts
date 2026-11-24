"use client";

import { useCallback, useEffect, useState } from "react";
import { loadPreferences, savePreferences } from "@/lib/preferences";
import type { UserPreferences } from "@/types";

/** Saved start/end time. `loaded` is false until LocalStorage has been read on the client. */
export function usePreferences() {
  const [prefs, setPrefs] = useState<Partial<UserPreferences>>({});
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    setPrefs(loadPreferences());
    setLoaded(true);
  }, []);

  const update = useCallback((next: UserPreferences) => {
    setPrefs(next);
    savePreferences(next);
  }, []);

  return { prefs, loaded, update };
}
