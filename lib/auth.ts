import { createHash, timingSafeEqual } from "node:crypto";

export type AccessCheck = { ok: true } | { ok: false; status: 401 | 500; code: string; message: string };

const digest = (s: string) => createHash("sha256").update(s, "utf8").digest();

/** Validate `Authorization: Bearer <key>` against BIRDIE_ACCESS_KEY. Fails closed when unset. */
export function checkAccessKey(authorization: string | null, expected = process.env.BIRDIE_ACCESS_KEY): AccessCheck {
  if (!expected) {
    return { ok: false, status: 500, code: "ACCESS_KEY_NOT_CONFIGURED", message: "Server access key is not configured." };
  }
  const provided = authorization?.match(/^Bearer\s+(.+)$/i)?.[1]?.trim();
  // Compare fixed-length digests so timingSafeEqual never throws on length mismatch.
  if (!provided || !timingSafeEqual(digest(provided), digest(expected))) {
    return { ok: false, status: 401, code: "UNAUTHORIZED", message: "Missing or invalid access key." };
  }
  return { ok: true };
}
