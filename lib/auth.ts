import { createHash, timingSafeEqual } from "node:crypto";

/**
 * Access keys come from environment variables:
 *   BIRDIE_ACCESS_KEYS = "name:key,name:key,..."   (one entry per person or group)
 *   BIRDIE_ACCESS_KEY  = "key"                      (legacy single key, accepted as name "owner")
 * Names are labels for logs only; keys never appear in logs.
 */
export interface AccessKeyEntry {
  name: string;
  digest: Buffer;
}

export type AccessCheck =
  | { ok: true; name: string }
  | { ok: false; status: 401 | 500; code: string; message: string };

const NAME_RE = /^[A-Za-z0-9_-]{1,40}$/;
const MIN_KEY_LENGTH = 16;

const digest = (s: string) => createHash("sha256").update(s, "utf8").digest();

export function parseAccessKeys(env: { BIRDIE_ACCESS_KEYS?: string; BIRDIE_ACCESS_KEY?: string }): AccessKeyEntry[] {
  const entries: AccessKeyEntry[] = [];
  for (const raw of (env.BIRDIE_ACCESS_KEYS ?? "").split(",")) {
    const item = raw.trim();
    if (!item) continue;
    const i = item.indexOf(":");
    const name = i > 0 ? item.slice(0, i).trim() : "";
    const key = i > 0 ? item.slice(i + 1).trim() : "";
    if (!NAME_RE.test(name) || key.length < MIN_KEY_LENGTH) {
      console.warn(`[birdie] ignoring malformed BIRDIE_ACCESS_KEYS entry${name ? ` "${name}"` : ""}`);
      continue;
    }
    entries.push({ name, digest: digest(key) });
  }
  const legacy = env.BIRDIE_ACCESS_KEY?.trim();
  if (legacy) entries.push({ name: "owner", digest: digest(legacy) });
  return entries;
}

let cached: { source: string; entries: AccessKeyEntry[] } | null = null;

function configuredKeys(): AccessKeyEntry[] {
  const source = `${process.env.BIRDIE_ACCESS_KEYS ?? ""}\u0000${process.env.BIRDIE_ACCESS_KEY ?? ""}`;
  if (cached?.source !== source) {
    cached = {
      source,
      entries: parseAccessKeys({
        BIRDIE_ACCESS_KEYS: process.env.BIRDIE_ACCESS_KEYS,
        BIRDIE_ACCESS_KEY: process.env.BIRDIE_ACCESS_KEY,
      }),
    };
  }
  return cached.entries;
}

/** Validate `Authorization: Bearer <key>` against the configured keys. Fails closed when none are set. */
export function checkAccessKey(authorization: string | null, keys: AccessKeyEntry[] = configuredKeys()): AccessCheck {
  if (!keys.length) {
    return { ok: false, status: 500, code: "ACCESS_KEY_NOT_CONFIGURED", message: "Server access key is not configured." };
  }
  const provided = authorization?.match(/^Bearer\s+(.+)$/i)?.[1]?.trim();
  if (provided) {
    const d = digest(provided);
    // Fixed-length digests: timingSafeEqual never throws, and every key is compared.
    let match: string | null = null;
    for (const k of keys) if (timingSafeEqual(d, k.digest) && match === null) match = k.name;
    if (match) return { ok: true, name: match };
  }
  return { ok: false, status: 401, code: "UNAUTHORIZED", message: "Missing or invalid access key." };
}
