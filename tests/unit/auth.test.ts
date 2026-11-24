import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

// In-memory stand-in for the Upstash REST client (only the commands Birdie uses).
const store = new Map<string, Map<string, unknown>>();
const h = (key: string) => store.get(key) ?? store.set(key, new Map()).get(key)!;
let failNext = false;

vi.mock("@upstash/redis", () => {
  class Redis {
    async hget(key: string, field: string) {
      if (failNext) {
        failNext = false;
        throw new Error("redis down");
      }
      return h(key).get(field) ?? null;
    }
    async hset(key: string, values: Record<string, unknown>) {
      for (const [f, v] of Object.entries(values)) h(key).set(f, v);
      return 1;
    }
    async hgetall(key: string) {
      const m = h(key);
      return m.size ? Object.fromEntries(m) : null;
    }
    async hmget(key: string, ...fields: string[]) {
      return Object.fromEntries(fields.map((f) => [f, h(key).get(f) ?? null]));
    }
    async hdel(key: string, ...fields: string[]) {
      let n = 0;
      for (const f of fields) if (h(key).delete(f)) n++;
      return n;
    }
    async hincrby(key: string, field: string, by: number) {
      const v = Number(h(key).get(field) ?? 0) + by;
      h(key).set(field, v);
      return v;
    }
    pipeline() {
      const ops: (() => Promise<unknown>)[] = [];
      const p = {
        hincrby: (k: string, f: string, b: number) => (ops.push(() => this.hincrby(k, f, b)), p),
        hset: (k: string, v: Record<string, unknown>) => (ops.push(() => this.hset(k, v)), p),
        exec: async () => Promise.all(ops.map((o) => o())),
      };
      return p;
    }
  }
  return { Redis };
});

const ADMIN = "owner-key-owner-key-owner-key";
let auth: typeof import("@/lib/auth");
let keystore: typeof import("@/lib/keystore");

beforeAll(async () => {
  process.env.UPSTASH_REDIS_REST_URL = "https://fake.upstash.io";
  process.env.UPSTASH_REDIS_REST_TOKEN = "token";
  auth = await import("@/lib/auth");
  keystore = await import("@/lib/keystore");
});

beforeEach(() => store.clear());

describe("admin (owner) key", () => {
  it("fails closed when no owner key is configured", async () => {
    expect(await auth.checkAccessKey(`Bearer ${ADMIN}`, "")).toMatchObject({ ok: false, status: 500 });
  });
  it("accepts the owner key as admin", async () => {
    expect(await auth.checkAccessKey(`Bearer ${ADMIN}`, ADMIN)).toMatchObject({ ok: true, admin: true, name: "owner" });
    expect(await auth.checkAccessKey(`bearer ${ADMIN}`, ADMIN)).toMatchObject({ ok: true, admin: true });
  });
  it("rejects missing or malformed headers", async () => {
    expect(await auth.checkAccessKey(null, ADMIN)).toMatchObject({ ok: false, status: 401 });
    expect(await auth.checkAccessKey(ADMIN, ADMIN)).toMatchObject({ ok: false, status: 401 });
  });
});

describe("user keys", () => {
  it("create → use → revoke", async () => {
    const { key, id } = await keystore.createKey("Alice");
    expect(key).toMatch(/^[A-Za-z0-9_-]{43}$/);

    const ok = await auth.checkAccessKey(`Bearer ${key}`, ADMIN);
    expect(ok).toMatchObject({ ok: true, admin: false, name: "Alice", id });

    const [item] = await keystore.listKeys();
    expect(item).toMatchObject({ id, name: "Alice", requests: 1 });
    expect(item.lastUsedAt).not.toBeNull();

    expect(await keystore.deleteKey(id)).toBe(true);
    expect(await auth.checkAccessKey(`Bearer ${key}`, ADMIN)).toMatchObject({ ok: false, status: 401 });
    expect(await keystore.listKeys()).toEqual([]);
  });

  it("stores only hashes, never the key itself", async () => {
    const { key } = await keystore.createKey("Bob");
    const dump = JSON.stringify([...store.entries()].map(([k, m]) => [k, [...m.entries()]]));
    expect(dump).not.toContain(key);
  });

  it("rejects duplicate names (case-insensitive)", async () => {
    await keystore.createKey("Carol");
    await expect(keystore.createKey("carol")).rejects.toThrow(/already exists/);
  });

  it("rejects unknown keys", async () => {
    expect(await auth.checkAccessKey("Bearer not-a-real-key-not-a-real-key", ADMIN)).toMatchObject({ ok: false, status: 401 });
  });

  it("answers 503, not 401, when the key store is down (so clients keep their key)", async () => {
    failNext = true;
    expect(await auth.checkAccessKey("Bearer some-uncached-key-some-uncached", ADMIN)).toMatchObject({ ok: false, status: 503 });
  });

  it("validates names", () => {
    expect(keystore.NAME_RE.test("Alice Smith")).toBe(true);
    expect(keystore.NAME_RE.test("")).toBe(false);
    expect(keystore.NAME_RE.test("a<script>")).toBe(false);
  });
});
