import { NextResponse } from "next/server";
import { reapExpiredUploads } from "@/lib/cleanup";

/**
 * Reap expired uploads. Intended to be hit by a cron/sweeper. Protected by a
 * shared secret in CLEANUP_SECRET (skip the check if it is unset, e.g. local).
 */
async function run(req: Request) {
  const secret = process.env.CLEANUP_SECRET;
  if (secret) {
    const provided =
      req.headers.get("x-cleanup-secret") ??
      req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
    if (provided !== secret) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  const reaped = await reapExpiredUploads();
  return NextResponse.json({ ok: true, reaped });
}

export const GET = run;
export const POST = run;
