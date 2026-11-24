"use client";

import { useCallback, useEffect, useState } from "react";
import { loadAccessKey, saveAccessKey } from "@/lib/preferences";

/** Birdie's own API key (not a UniMelb credential), kept in LocalStorage. */
export function useAccessKey() {
  const [key, setKey] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    setKey(loadAccessKey());
    setLoaded(true);
  }, []);

  const save = useCallback((value: string) => {
    saveAccessKey(value);
    setKey(value);
  }, []);

  const clear = useCallback(() => {
    saveAccessKey(null);
    setKey(null);
  }, []);

  return { key, loaded, save, clear };
}
