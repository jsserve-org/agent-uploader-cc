import { env } from "@/env";

export function humanizeDuration(seconds: number): string {
  if (seconds % 86400 === 0) {
    const d = seconds / 86400;
    return `${d} day${d === 1 ? "" : "s"}`;
  }
  if (seconds % 3600 === 0) {
    const h = seconds / 3600;
    return `${h} hour${h === 1 ? "" : "s"}`;
  }
  const m = Math.round(seconds / 60);
  return `${m} minute${m === 1 ? "" : "s"}`;
}

/**
 * Build the copy-paste prompt a user hands to their AI agent. It embeds the
 * single-use key and the exact curl command to run. `token` is only available
 * at creation time; afterwards we render a placeholder instead.
 */
export function buildAgentPrompt(opts: {
  token: string;
  retentionSeconds: number;
  singleUse: boolean;
  appUrl?: string;
}): string {
  const base = (opts.appUrl ?? env.appUrl).replace(/\/$/, "");
  const uploadUrl = `${base}/api/upload`;
  const retention = humanizeDuration(opts.retentionSeconds);
  const useLine = opts.singleUse
    ? "This key is SINGLE USE — it works for exactly one upload, then it is permanently burned."
    : "This key may be used a limited number of times.";

  return `You have access to a file-upload service. Upload the target file (for example an APK) using the single-use key and endpoint below.

${useLine}
The uploaded file is automatically deleted after ${retention}.

Run this command, replacing /path/to/file with the real file path:

  curl -sS -X POST "${uploadUrl}" \\
    -H "Authorization: Bearer ${opts.token}" \\
    -F "file=@/path/to/file"

On success the response is JSON like:

  { "ok": true, "url": "${base}/f/<id>", "filename": "...", "expiresAt": "..." }

Report the "url" value back — that is the public download link. Do not reuse the key after a successful upload.`;
}
