import { createHash, timingSafeEqual } from "node:crypto";
import { findKey, hashKey, keystoreConfigured, recordUse } from "./keystore";

/**
 * Two kinds of access key:
 * - Admin key: env BIRDIE_ACCESS_KEY (the owner). Can use Birdie and manage other keys at /admin.
 * - User keys: created at /admin, stored (hashed) in Upstash Redis. Can only use Birdie.
 */
export type AccessCheck =
  | { ok: true; name: string; id: string; admin: boolean }
  | { ok: false; status: 401 | 500 | 503; code: string; message: string };

const digest = (s: string) => createHash("sha256").update(s, "utf8").digest();

export function bearer(authorization: string | null): string | null {
  return authorization?.match(/^Bearer\s+(.+)$/i)?.[1]?.trim() || null;
}

export function isAdminKey(provided: string, adminKey: string | undefined): boolean {
  if (!adminKey) return false;
  // Fixed-length digests so timingSafeEqual never throws on length mismatch.
  return timingSafeEqual(digest(provided), digest(adminKey));
}

const unauthorized: AccessCheck = { ok: false, status: 401, code: "UNAUTHORIZED", message: "Missing or invalid access key." };

/** Validate a request's key. Records usage for successful checks. */
export async function checkAccessKey(
  authorization: string | null,
  adminKey: string | undefined = process.env.BIRDIE_ACCESS_KEY?.trim(),
): Promise<AccessCheck> {
  if (!adminKey) {
    return { ok: false, status: 500, code: "ACCESS_KEY_NOT_CONFIGURED", message: "Server access key is not configured." };
  }
  const provided = bearer(authorization);
  if (!provided) return unauthorized;

  if (isAdminKey(provided, adminKey)) {
    await recordUse("owner");
    return { ok: true, name: "owner", id: "owner", admin: true };
  }

  if (!keystoreConfigured()) return unauthorized;
  const id = hashKey(provided);
  try {
    const record = await findKey(id);
    if (!record) return unauthorized;
    await recordUse(id);
    return { ok: true, name: record.name, id, admin: false };
  } catch (err) {
    // Never answer 401 when the store is down: the client would discard a valid key.
    console.error(`[birdie] key lookup failed: ${(err as Error).message}`);
    return { ok: false, status: 503, code: "KEYSTORE_UNAVAILABLE", message: "Access check is temporarily unavailable." };
  }
}
