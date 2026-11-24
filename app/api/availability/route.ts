import { checkAccessKey } from "@/lib/auth";
import { getAvailability } from "@/lib/perfectmind/availability";
import { UpstreamError } from "@/lib/perfectmind/client";
import { validateDate } from "@/lib/validation";
import type { ApiError } from "@/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function error(status: number, code: string, message: string, retryable: boolean) {
  const body: ApiError = { error: { code, message, retryable } };
  return Response.json(body, { status, headers: { "Cache-Control": "no-store" } });
}

export async function GET(request: Request) {
  const auth = await checkAccessKey(request.headers.get("authorization"));
  if (!auth.ok) return error(auth.status, auth.code, auth.message, false);

  const params = new URL(request.url).searchParams;
  const date = params.get("date");
  const invalid = validateDate(date);
  if (invalid) return error(400, "INVALID_DATE", invalid, false);

  const refresh = params.get("refresh") === "true";
  // Who is using Birdie (key name only, never the key itself).
  console.info(`[birdie] request key=${auth.name} date=${date}${refresh ? " refresh" : ""}`);

  try {
    const data = await getAvailability(date!, { refresh });
    // Lets the app show the "Manage access" link to the owner only.
    return Response.json(data, { headers: { "Cache-Control": "no-store", "X-Birdie-Admin": auth.admin ? "1" : "0" } });
  } catch (err) {
    console.error(`[birdie] /api/availability ${date}: ${(err as Error).message}`);
    if (err instanceof UpstreamError && err.status === 503) {
      return error(503, "UPSTREAM_UNAVAILABLE", "The official booking system is temporarily unavailable.", true);
    }
    return error(502, "UPSTREAM_UNAVAILABLE", "Unable to retrieve court availability.", true);
  }
}
