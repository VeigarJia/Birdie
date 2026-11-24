"use client";

import { useCallback, useEffect, useState } from "react";
import { AccessKeyPrompt } from "@/components/AccessKeyPrompt";
import { useAccessKey } from "@/hooks/useAccessKey";
import { formatAge } from "@/lib/time";

interface KeyItem {
  id: string;
  name: string;
  createdAt: string;
  lastUsedAt: string | null;
  requests: number;
}

interface Usage {
  lastUsedAt: string | null;
  requests: number;
}

type Status =
  | { kind: "loading" }
  | { kind: "ready"; owner: Usage; keys: KeyItem[] }
  | { kind: "forbidden" }
  | { kind: "not-configured" }
  | { kind: "error"; message: string };

function lastUsed(iso: string | null): string {
  if (!iso) return "Never used";
  return `Used ${formatAge((Date.now() - Date.parse(iso)) / 1000)}`;
}

function createdOn(iso: string): string {
  return new Date(iso).toLocaleDateString("en-AU", { day: "2-digit", month: "short", year: "numeric" });
}

async function copy(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

export default function AdminPage() {
  const accessKey = useAccessKey();
  const [rejected, setRejected] = useState(false);
  const [status, setStatus] = useState<Status>({ kind: "loading" });
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [created, setCreated] = useState<{ name: string; key: string } | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  const api = useCallback(
    (init?: RequestInit & { query?: string }) =>
      fetch(`/api/admin/keys${init?.query ?? ""}`, {
        ...init,
        cache: "no-store",
        headers: { Authorization: `Bearer ${accessKey.key}`, "Content-Type": "application/json" },
      }),
    [accessKey.key],
  );

  const handleAuthErrors = useCallback(
    async (res: Response): Promise<boolean> => {
      if (res.status === 401) {
        accessKey.clear();
        setRejected(true);
        return true;
      }
      if (res.status === 403) {
        setStatus({ kind: "forbidden" });
        return true;
      }
      if (res.status === 503) {
        const body = await res.json().catch(() => null);
        if (body?.error?.code === "KEYSTORE_NOT_CONFIGURED") setStatus({ kind: "not-configured" });
        else setStatus({ kind: "error", message: body?.error?.message ?? "Service unavailable." });
        return true;
      }
      return false;
    },
    // Only stable callbacks here: depending on a per-render object re-created `load`
    // on every render and made the effect below refetch in a loop.
    [accessKey.clear],
  );

  const load = useCallback(async () => {
    if (!accessKey.key) return;
    try {
      const res = await api();
      if (await handleAuthErrors(res)) return;
      if (!res.ok) throw new Error(`Request failed (${res.status})`);
      const body = (await res.json()) as { owner: Usage; keys: KeyItem[] };
      setStatus({ kind: "ready", owner: body.owner, keys: body.keys });
    } catch (err) {
      setStatus({ kind: "error", message: (err as Error).message });
    }
  }, [accessKey.key, api, handleAuthErrors]);

  useEffect(() => {
    void load();
  }, [load]);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;
    setBusy(true);
    setFormError(null);
    try {
      const res = await api({ method: "POST", body: JSON.stringify({ name: trimmed }) });
      if (await handleAuthErrors(res)) return;
      const body = await res.json().catch(() => null);
      if (!res.ok) {
        setFormError(body?.error?.message ?? "Could not create key.");
        return;
      }
      setCreated({ name: body.name, key: body.key });
      setCopied(null);
      setName("");
      await load();
    } finally {
      setBusy(false);
    }
  }

  async function revoke(item: KeyItem) {
    if (!window.confirm(`Revoke the key for “${item.name}”? They won't be able to use Birdie until you give them a new key.`)) return;
    const res = await api({ method: "DELETE", query: `?id=${item.id}` });
    if (await handleAuthErrors(res)) return;
    if (!res.ok && res.status !== 404) {
      window.alert("Could not revoke the key. Try again.");
      return;
    }
    if (created?.name === item.name) setCreated(null);
    await load();
  }

  const invite = created
    ? `Birdie 🏸 UniMelb badminton courts\n${window.location.origin}\n\nAccess key: ${created.key}\n\nOn iPhone: open the link in Safari → Share → Add to Home Screen, open Birdie from the Home Screen, then paste the key.`
    : "";

  let body: React.ReactNode;
  if (!accessKey.loaded) body = null;
  else if (!accessKey.key) {
    body = (
      <AccessKeyPrompt
        invalid={rejected}
        onSubmit={(k) => {
          setRejected(false);
          setStatus({ kind: "loading" });
          accessKey.save(k);
        }}
      />
    );
  } else if (status.kind === "loading") body = <p className="mt-8 text-sm text-muted">Loading…</p>;
  else if (status.kind === "forbidden") {
    body = <p className="mt-8 text-sm text-muted">This key can use Birdie but can&apos;t manage access. Only the owner key can.</p>;
  } else if (status.kind === "not-configured") {
    body = (
      <div className="mt-8 rounded-xl border border-line bg-surface p-5 text-sm">
        <p className="font-medium">Key storage isn&apos;t set up yet</p>
        <p className="mt-1 text-muted">
          In Vercel, open this project → <b>Storage</b> → connect an <b>Upstash for Redis</b> database, then redeploy.
        </p>
      </div>
    );
  } else if (status.kind === "error") {
    body = (
      <div className="mt-8 rounded-xl border border-line bg-surface p-5 text-sm" role="alert">
        <p className="font-medium">Something went wrong</p>
        <p className="mt-1 text-muted">{status.message}</p>
        <button type="button" onClick={() => void load()} className="mt-3 h-11 rounded-[10px] bg-accent px-5 font-semibold text-bg">
          Try again
        </button>
      </div>
    );
  } else {
    body = (
      <>
        <form onSubmit={create} className="mt-6">
          <label htmlFor="new-name" className="block text-sm font-medium">
            Give someone access
          </label>
          <div className="mt-2 flex gap-2">
            <input
              id="new-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Name, e.g. Alice"
              maxLength={40}
              autoComplete="off"
              className="h-11 min-w-0 flex-1 rounded-[10px] border border-line bg-surface px-3 text-base"
            />
            <button type="submit" disabled={busy || !name.trim()} className="h-11 shrink-0 rounded-[10px] bg-accent px-4 text-sm font-semibold text-bg disabled:opacity-40">
              {busy ? "Creating…" : "Create key"}
            </button>
          </div>
          {formError && <p className="mt-2 text-sm text-danger">{formError}</p>}
        </form>

        {created && (
          <div className="mt-4 rounded-xl border border-available-bg bg-surface p-4">
            <p className="text-sm font-medium">Key for {created.name}</p>
            <p className="mt-2 break-all rounded-lg bg-bg p-3 font-mono text-sm select-all">{created.key}</p>
            <p className="mt-2 text-xs text-warn">Copy it now. It won&apos;t be shown again.</p>
            <div className="mt-3 flex gap-2">
              <button
                type="button"
                onClick={async () => setCopied((await copy(invite)) ? "invite" : "failed")}
                className="h-11 flex-1 rounded-[10px] bg-accent px-3 text-sm font-semibold text-bg"
              >
                {copied === "invite" ? "Copied ✓" : "Copy invite message"}
              </button>
              <button
                type="button"
                onClick={async () => setCopied((await copy(created.key)) ? "key" : "failed")}
                className="h-11 rounded-[10px] border border-line px-3 text-sm font-medium"
              >
                {copied === "key" ? "Copied ✓" : "Copy key"}
              </button>
            </div>
            {copied === "failed" && <p className="mt-2 text-xs text-danger">Copy failed. Select the key above and copy it manually.</p>}
          </div>
        )}

        <h2 className="mt-8 text-[15px] font-semibold">People with access</h2>
        <ul className="mt-2 divide-y divide-line rounded-xl border border-line">
          <li className="flex items-center justify-between gap-3 p-3">
            <div className="min-w-0">
              <p className="text-sm font-medium">You (owner)</p>
              <p className="text-xs text-muted">
                {lastUsed(status.owner.lastUsedAt)} · {status.owner.requests} requests
              </p>
            </div>
          </li>
          {status.keys.map((k) => (
            <li key={k.id} className="flex items-center justify-between gap-3 p-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{k.name}</p>
                <p className="text-xs text-muted">
                  Added {createdOn(k.createdAt)} · {lastUsed(k.lastUsedAt)} · {k.requests} requests
                </p>
              </div>
              <button type="button" onClick={() => void revoke(k)} className="h-11 shrink-0 rounded-[10px] px-3 text-sm font-medium text-danger active:bg-surface">
                Revoke
              </button>
            </li>
          ))}
        </ul>
        {status.keys.length === 0 && <p className="mt-2 text-xs text-muted">No one else has access yet.</p>}
        <p className="mt-3 text-xs text-muted">Revoked keys stop working within a minute.</p>
      </>
    );
  }

  return (
    <main className="mx-auto max-w-2xl px-4 pb-10">
      <header className="flex items-center justify-between pt-3">
        <h1 className="text-[22px] font-semibold tracking-tight">
          <span aria-hidden>🏸</span> Manage access
        </h1>
        <a href="/" className="flex h-11 items-center text-sm font-medium text-accent">
          ← Birdie
        </a>
      </header>
      {body}
    </main>
  );
}
