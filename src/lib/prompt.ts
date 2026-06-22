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
  folder?: string | null;
  allowedTypes?: string | null;
  maxDownloads?: number | null;
  hasPassword?: boolean;
}): string {
  const base = (opts.appUrl ?? env.appUrl).replace(/\/$/, "");
  const uploadUrl = `${base}/api/upload`;
  const retention = humanizeDuration(opts.retentionSeconds);
  const useLine = opts.singleUse
    ? "This key is SINGLE USE — it works for exactly one upload, then it is permanently burned."
    : "This key may be used a limited number of times.";

  // Extra constraints worth telling the agent about, rendered as bullet lines.
  const constraints: string[] = [];
  if (opts.allowedTypes) {
    constraints.push(`- Only these file types are accepted: ${opts.allowedTypes}`);
  }
  if (opts.maxDownloads) {
    constraints.push(
      `- The uploaded file may be downloaded at most ${opts.maxDownloads} time(s) before it is deleted.`,
    );
  }
  if (opts.hasPassword) {
    constraints.push(
      `- Downloads are password-protected; share the password (provided separately) with whoever needs the file.`,
    );
  }
  const constraintsBlock =
    constraints.length > 0 ? `\nConstraints:\n${constraints.join("\n")}\n` : "";

  // Optional header to drop the upload into a specific folder.
  const folderHeader = opts.folder
    ? ` \\\n    -H "X-Folder: ${opts.folder}"`
    : "";

  return `You have access to a file-upload service. Upload the target file (for example an APK) using the key and endpoint below.

${useLine}
The uploaded file is automatically deleted after ${retention}.
${constraintsBlock}
Run this command, replacing /path/to/file with the real file path:

  curl -sS -X POST "${uploadUrl}" \\
    -H "Authorization: Bearer ${opts.token}"${folderHeader} \\
    -F "file=@/path/to/file"

On success the response is JSON like:

  { "ok": true, "url": "${base}/f/<id>", "filename": "...", "expiresAt": "..." }

Report the "url" value back — that is the download link. Do not reuse the key after a successful upload.`;
}
