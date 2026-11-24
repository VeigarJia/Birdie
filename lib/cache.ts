/** Small in-memory TTL cache with in-flight request coalescing (per server instance). */
export class TtlCache<T> {
  private readonly values = new Map<string, { value: T; expiresAt: number }>();
  private readonly inflight = new Map<string, Promise<T>>();

  get(key: string): T | undefined {
    const hit = this.values.get(key);
    if (!hit) return undefined;
    if (Date.now() >= hit.expiresAt) {
      this.values.delete(key);
      return undefined;
    }
    return hit.value;
  }

  set(key: string, value: T, ttlSeconds: number): void {
    this.values.set(key, { value, expiresAt: Date.now() + ttlSeconds * 1000 });
    if (this.values.size > 200) {
      const now = Date.now();
      for (const [k, v] of this.values) if (now >= v.expiresAt) this.values.delete(k);
    }
  }

  /**
   * Return a cached value, or run `load` once even if many callers ask concurrently.
   * `force` skips the cached value but still joins an in-flight load.
   */
  async getOrLoad(key: string, load: () => Promise<{ value: T; ttlSeconds: number }>, force = false): Promise<T> {
    if (!force) {
      const hit = this.get(key);
      if (hit !== undefined) return hit;
    }
    const running = this.inflight.get(key);
    if (running) return running;

    const promise = load()
      .then(({ value, ttlSeconds }) => {
        this.set(key, value, ttlSeconds);
        return value;
      })
      .finally(() => this.inflight.delete(key));
    this.inflight.set(key, promise);
    return promise;
  }
}

/** Run async tasks with at most `limit` in flight, preserving result order. */
export async function mapLimit<I, O>(items: I[], limit: number, fn: (item: I) => Promise<O>): Promise<O[]> {
  const results = new Array<O>(items.length);
  let next = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const i = next++;
      results[i] = await fn(items[i]);
    }
  });
  await Promise.all(workers);
  return results;
}
