import { UPSTREAM_TIMEOUT_MS } from "../constants";
import { PM_ORIGIN, PM_ORG_PATH, PM_USER_AGENT } from "./config";

export class UpstreamError extends Error {
  constructor(
    message: string,
    readonly code: "UPSTREAM_UNAVAILABLE" | "UPSTREAM_BAD_RESPONSE" | "UPSTREAM_SESSION",
    readonly retryable: boolean,
    readonly status?: number,
  ) {
    super(message);
    this.name = "UpstreamError";
  }
}

/**
 * Minimal anonymous HTTP client for PerfectMind with its own cookie jar.
 * Only paths under the tenant on the fixed origin are allowed (no client-supplied URLs).
 */
export class PerfectMindHttp {
  private readonly jar = new Map<string, string>();

  private cookieHeader(): string {
    return [...this.jar].map(([k, v]) => `${k}=${v}`).join("; ");
  }

  private storeCookies(res: Response): void {
    for (const raw of res.headers.getSetCookie()) {
      const pair = raw.split(";")[0];
      const i = pair.indexOf("=");
      if (i > 0) this.jar.set(pair.slice(0, i).trim(), pair.slice(i + 1).trim());
    }
  }

  private resolve(pathOrUrl: string): URL {
    const url = new URL(pathOrUrl, PM_ORIGIN);
    if (url.origin !== PM_ORIGIN || !url.pathname.startsWith(`${PM_ORG_PATH}/`)) {
      throw new UpstreamError(`Refusing non-PerfectMind URL: ${url.origin}${url.pathname}`, "UPSTREAM_BAD_RESPONSE", false);
    }
    return url;
  }

  async request(path: string, init: { method?: "GET" | "POST"; body?: string; xhr?: boolean } = {}): Promise<Response> {
    let url = this.resolve(path);
    let method = init.method ?? "GET";
    let body = init.body;
    for (let hop = 0; hop < 5; hop++) {
      const headers: Record<string, string> = { "User-Agent": PM_USER_AGENT };
      const cookie = this.cookieHeader();
      if (cookie) headers.Cookie = cookie;
      if (method === "POST") headers["Content-Type"] = "application/x-www-form-urlencoded; charset=UTF-8";
      if (init.xhr) headers["X-Requested-With"] = "XMLHttpRequest";

      let res: Response;
      try {
        res = await fetch(url, {
          method,
          body,
          headers,
          redirect: "manual",
          signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
          cache: "no-store",
        });
      } catch (err) {
        throw new UpstreamError(`PerfectMind request failed: ${(err as Error).message}`, "UPSTREAM_UNAVAILABLE", true);
      }
      this.storeCookies(res);

      const location = res.headers.get("location");
      if (res.status >= 300 && res.status < 400 && location) {
        url = this.resolve(new URL(location, url).href);
        method = "GET";
        body = undefined;
        continue;
      }
      return res;
    }
    throw new UpstreamError("Too many redirects from PerfectMind", "UPSTREAM_SESSION", true);
  }

  async getHtml(path: string): Promise<string> {
    const res = await this.request(path);
    if (!res.ok) {
      throw new UpstreamError(`PerfectMind page returned ${res.status}`, "UPSTREAM_UNAVAILABLE", res.status >= 500, res.status);
    }
    return res.text();
  }

  /** POST a form and parse JSON. Non-JSON responses usually mean the anonymous session expired. */
  async postJson<T>(path: string, form: URLSearchParams): Promise<T> {
    const res = await this.request(path, { method: "POST", body: form.toString(), xhr: true });
    const text = await res.text();
    if (res.status === 429 || res.status >= 500) {
      throw new UpstreamError(`PerfectMind returned ${res.status}`, "UPSTREAM_UNAVAILABLE", true, res.status);
    }
    if (!res.ok || !(res.headers.get("content-type") ?? "").includes("json")) {
      throw new UpstreamError(`Unexpected PerfectMind response (${res.status})`, "UPSTREAM_SESSION", true, res.status);
    }
    try {
      return JSON.parse(text) as T;
    } catch {
      throw new UpstreamError("PerfectMind returned invalid JSON", "UPSTREAM_BAD_RESPONSE", false, res.status);
    }
  }
}
