import { createHash, randomBytes } from "node:crypto";
import { Redis } from "@upstash/redis";

/**
 * Access keys for other users, managed from /admin and stored in Upstash Redis.
 * Only SHA-256 hashes are stored: a key is shown once at creation and cannot be recovered.
 *
 * Redis layout:
 *   birdie:keys   hash  <keyHash> -> JSON { name, createdAt }
 *   birdie:usage  hash  <keyHash>:count -> number, <keyHash>:last -> ISO time
 */
const KEYS = "birdie:keys";
const USAGE = "birdie:usage";

export interface KeyRecord {
  name: string;
  createdAt: string;
}

export interface KeyListItem extends KeyRecord {
  id: string;
  lastUsedAt: string | null;
  requests: number;
}

export class KeystoreUnavailable extends Error {
  constructor(message = "Key store is not configured") {
    super(message);
    this.name = "KeystoreUnavailable";
  }
}

export const NAME_RE = /^[A-Za-z0-9 _.-]{1,40}$/;

export function hashKey(key: string): string {
  return createHash("sha256").update(key, "utf8").digest("hex");
}

export function generateKey(): string {
  // 32 random bytes, URL-safe, easy to copy and paste.
  return randomBytes(32).toString("base64url");
}

let client: Redis | null | undefined;

/** Works with both Vercel Marketplace (KV_*) and Upstash console (UPSTASH_*) variable names. */
function redis(): Redis | null {
  if (client !== undefined) return client;
  const url = process.env.UPSTASH_REDIS_REST_URL ?? process.env.KV_REST_API_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN ?? process.env.KV_REST_API_TOKEN;
  client = url && token ? new Redis({ url, token }) : null;
  return client;
}

export function keystoreConfigured(): boolean {
  return redis() !== null;
}

function requireRedis(): Redis {
  const r = redis();
  if (!r) throw new KeystoreUnavailable();
  return r;
}

/** Short-lived per-instance cache so most requests skip the Redis lookup. Revocation applies within a minute. */
const lookupCache = new Map<string, { record: KeyRecord | null; expiresAt: number }>();
const LOOKUP_TTL_MS = 60_000;

export async function findKey(keyHash: string): Promise<KeyRecord | null> {
  const hit = lookupCache.get(keyHash);
  if (hit && hit.expiresAt > Date.now()) return hit.record;
  const raw = await requireRedis().hget<KeyRecord | string>(KEYS, keyHash);
  const record = raw == null ? null : typeof raw === "string" ? (JSON.parse(raw) as KeyRecord) : raw;
  // Cache hits for a minute; misses only briefly so a freshly created key works right away.
  lookupCache.set(keyHash, { record, expiresAt: Date.now() + (record ? LOOKUP_TTL_MS : 5_000) });
  return record;
}

/** Best effort: usage stats must never block or fail a request. */
export async function recordUse(id: string): Promise<void> {
  const r = redis();
  if (!r) return;
  try {
    await r.pipeline().hincrby(USAGE, `${id}:count`, 1).hset(USAGE, { [`${id}:last`]: new Date().toISOString() }).exec();
  } catch (err) {
    console.warn(`[birdie] usage tracking failed: ${(err as Error).message}`);
  }
}

export async function listKeys(): Promise<KeyListItem[]> {
  const r = requireRedis();
  const [keys, usage] = await Promise.all([
    r.hgetall<Record<string, KeyRecord | string>>(KEYS),
    r.hgetall<Record<string, string | number>>(USAGE),
  ]);
  const items = Object.entries(keys ?? {}).map(([id, raw]) => {
    const rec = typeof raw === "string" ? (JSON.parse(raw) as KeyRecord) : raw;
    return {
      id,
      name: rec.name,
      createdAt: rec.createdAt,
      lastUsedAt: (usage?.[`${id}:last`] as string | undefined) ?? null,
      requests: Number(usage?.[`${id}:count`] ?? 0),
    };
  });
  return items.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

export async function usageFor(id: string): Promise<{ lastUsedAt: string | null; requests: number }> {
  const v = await requireRedis().hmget<Record<string, string | number | null>>(USAGE, `${id}:count`, `${id}:last`);
  return {
    lastUsedAt: (v?.[`${id}:last`] as string | null | undefined) ?? null,
    requests: Number(v?.[`${id}:count`] ?? 0),
  };
}

export async function createKey(name: string): Promise<{ id: string; key: string; record: KeyRecord }> {
  const r = requireRedis();
  const existing = await listKeys();
  if (existing.some((k) => k.name.toLowerCase() === name.toLowerCase())) {
    throw new Error(`A key named "${name}" already exists`);
  }
  const key = generateKey();
  const id = hashKey(key);
  const record: KeyRecord = { name, createdAt: new Date().toISOString() };
  await r.hset(KEYS, { [id]: JSON.stringify(record) });
  lookupCache.delete(id);
  return { id, key, record };
}

export async function deleteKey(id: string): Promise<boolean> {
  const r = requireRedis();
  const removed = await r.hdel(KEYS, id);
  await r.hdel(USAGE, `${id}:count`, `${id}:last`);
  lookupCache.delete(id);
  return removed > 0;
}
