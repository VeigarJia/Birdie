import { checkAccessKey } from "@/lib/auth";
import { KeystoreUnavailable, NAME_RE, createKey, deleteKey, keystoreConfigured, listKeys, usageFor } from "@/lib/keystore";
import type { ApiError } from "@/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function error(status: number, code: string, message: string) {
  const body: ApiError = { error: { code, message, retryable: status >= 500 } };
  return Response.json(body, { status, headers: { "Cache-Control": "no-store" } });
}

async function requireAdmin(request: Request): Promise<Response | null> {
  const auth = await checkAccessKey(request.headers.get("authorization"));
  if (!auth.ok) return error(auth.status, auth.code, auth.message);
  if (!auth.admin) return error(403, "FORBIDDEN", "Only the owner key can manage access.");
  if (!keystoreConfigured()) {
    return error(503, "KEYSTORE_NOT_CONFIGURED", "Connect Upstash Redis to this Vercel project to manage keys.");
  }
  return null;
}

function failure(err: unknown) {
  console.error(`[birdie] admin: ${(err as Error).message}`);
  if (err instanceof KeystoreUnavailable) return error(503, "KEYSTORE_NOT_CONFIGURED", err.message);
  return error(503, "KEYSTORE_UNAVAILABLE", "Could not reach the key store. Try again.");
}

/** List keys (never their values) with usage. */
export async function GET(request: Request) {
  const denied = await requireAdmin(request);
  if (denied) return denied;
  try {
    const [keys, owner] = await Promise.all([listKeys(), usageFor("owner")]);
    return Response.json({ owner, keys }, { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    return failure(err);
  }
}

/** Create a key. The key value is returned only in this response. */
export async function POST(request: Request) {
  const denied = await requireAdmin(request);
  if (denied) return denied;
  const body = (await request.json().catch(() => null)) as { name?: unknown } | null;
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  if (!NAME_RE.test(name)) {
    return error(400, "INVALID_NAME", "Use 1–40 letters, digits, spaces, dots, dashes or underscores.");
  }
  try {
    const { id, key, record } = await createKey(name);
    console.info(`[birdie] admin created key name=${name}`);
    return Response.json({ id, key, ...record }, { status: 201, headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    if ((err as Error).message.startsWith("A key named")) return error(409, "NAME_TAKEN", (err as Error).message);
    return failure(err);
  }
}

/** Revoke a key by id: DELETE /api/admin/keys?id=<id> */
export async function DELETE(request: Request) {
  const denied = await requireAdmin(request);
  if (denied) return denied;
  const id = new URL(request.url).searchParams.get("id") ?? "";
  if (!/^[0-9a-f]{64}$/.test(id)) return error(400, "INVALID_ID", "Invalid key id.");
  try {
    const removed = await deleteKey(id);
    if (!removed) return error(404, "NOT_FOUND", "Key not found.");
    console.info(`[birdie] admin revoked key id=${id.slice(0, 8)}`);
    return new Response(null, { status: 204 });
  } catch (err) {
    return failure(err);
  }
}
