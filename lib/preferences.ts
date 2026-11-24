import { STORAGE_KEYS } from "./constants";
import type { UserPreferences } from "@/types";

const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

/** LocalStorage can throw (private mode, blocked storage); every access is guarded. */
function read(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function write(key: string, value: string | null): void {
  try {
    if (value == null) window.localStorage.removeItem(key);
    else window.localStorage.setItem(key, value);
  } catch {
    /* ignore */
  }
}

export function loadPreferences(): Partial<UserPreferences> {
  try {
    const parsed = JSON.parse(read(STORAGE_KEYS.preferences) ?? "null");
    if (parsed && TIME_RE.test(parsed.startTime) && TIME_RE.test(parsed.endTime)) {
      return { startTime: parsed.startTime, endTime: parsed.endTime };
    }
  } catch {
    /* ignore */
  }
  return {};
}

export function savePreferences(prefs: UserPreferences): void {
  write(STORAGE_KEYS.preferences, JSON.stringify(prefs));
}

export function loadAccessKey(): string | null {
  return read(STORAGE_KEYS.accessKey);
}

export function saveAccessKey(key: string | null): void {
  write(STORAGE_KEYS.accessKey, key);
}
