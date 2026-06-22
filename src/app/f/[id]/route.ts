import { Readable } from "node:stream";
import { eq, sql } from "drizzle-orm";
import { nanoid } from "nanoid";
import { db } from "@/db";
import { upload, downloadEvent } from "@/db/schema";
import {
  readBlobStream,
  readBlob,
  blobExists,
  deleteBlob,
} from "@/lib/storage";
import { hashToken } from "@/lib/keys";
import { looksLikeApk, APK_CONTENT_TYPE } from "@/lib/apk";

export const runtime = "nodejs";

function clientIp(req: Request): string {
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0].trim();
  return req.headers.get("x-real-ip") ?? "unknown";
}

/** Extract a supplied download password from query, header, or bearer token. */
function suppliedPassword(req: Request, url: URL): string | null {
  return (
    url.searchParams.get("pw") ??
    url.searchParams.get("password") ??
    req.headers.get("x-download-password") ??
    req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ??
    null
  );
}

function passwordForm(id: string, wrong: boolean): Response {
  const body = `<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Password required</title>
<style>body{font-family:ui-sans-serif,system-ui,sans-serif;background:#0a0a0a;color:#fafafa;display:grid;place-items:center;min-height:100vh;margin:0}
form{background:#171717;border:1px solid #262626;border-radius:12px;padding:24px;width:min(92vw,340px)}
h1{font-size:1rem;margin:0 0 4px}p{color:#a3a3a3;font-size:.85rem;margin:0 0 16px}
input{width:100%;box-sizing:border-box;padding:8px 10px;border-radius:8px;border:1px solid #404040;background:#0a0a0a;color:#fafafa;margin-bottom:12px}
button{width:100%;padding:8px;border:0;border-radius:8px;background:#fafafa;color:#0a0a0a;font-weight:600;cursor:pointer}
.err{color:#f87171;font-size:.8rem;margin-bottom:12px}</style></head>
<body><form method="get" action="/f/${id}">
<h1>This file is password-protected</h1>
<p>Enter the password to download.</p>
${wrong ? '<div class="err">Incorrect password.</div>' : ""}
<input type="password" name="pw" placeholder="Password" autofocus required>
<button type="submit">Download</button>
</form></body></html>`;
  return new Response(body, {
    status: wrong ? 401 : 401,
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const url = new URL(req.url);

  const [row] = await db
    .select()
    .from(upload)
    .where(eq(upload.id, id))
    .limit(1);

  if (!row) {
    return new Response("Not found", { status: 404 });
  }

  // Lazy expiry: if the retention window passed, reap and 410.
  if (row.expiresAt.getTime() < Date.now()) {
    await deleteBlob(row.storageKey);
    await db.delete(upload).where(eq(upload.id, id));
    return new Response("This file has expired.", { status: 410 });
  }

  // Download-count cap.
  if (row.maxDownloads != null && row.downloadCount >= row.maxDownloads) {
    await deleteBlob(row.storageKey);
    await db.delete(upload).where(eq(upload.id, id));
    return new Response("This file is no longer available.", { status: 410 });
  }

  // Password protection.
  if (row.passwordHash) {
    const supplied = suppliedPassword(req, url);
    if (!supplied) {
      const wantsHtml = (req.headers.get("accept") ?? "").includes("text/html");
      return wantsHtml
        ? passwordForm(id, false)
        : new Response("Password required (pass ?pw= or X-Download-Password).", {
            status: 401,
          });
    }
    if (hashToken(supplied) !== row.passwordHash) {
      const wantsHtml = (req.headers.get("accept") ?? "").includes("text/html");
      return wantsHtml
        ? passwordForm(id, true)
        : new Response("Incorrect password.", { status: 401 });
    }
  }

  if (!(await blobExists(row.storageKey))) {
    return new Response("File is missing.", { status: 404 });
  }

  const newCount = row.downloadCount + 1;
  const terminal = row.maxDownloads != null && newCount >= row.maxDownloads;

  // Record the access (count, timestamp, analytics event).
  await db
    .update(upload)
    .set({ downloadCount: newCount, lastDownloadAt: new Date() })
    .where(eq(upload.id, id));
  await db.insert(downloadEvent).values({
    id: nanoid(),
    uploadId: id,
    userId: row.userId,
    keyId: row.keyId,
    ipAddress: clientIp(req),
  });

  // Serve APKs with the Android package MIME so phones offer to install them.
  const isApk = row.isApk || looksLikeApk(row.filename, row.contentType);
  const serveType = isApk
    ? APK_CONTENT_TYPE
    : row.contentType || "application/octet-stream";

  const headers = {
    "Content-Type": serveType,
    "Content-Length": String(row.size),
    "Content-Disposition": `attachment; filename="${row.filename}"`,
    "Cache-Control": "private, no-store",
  };

  // If this download exhausts the cap, read the bytes, delete, then return them
  // so no copy lingers. Otherwise stream straight off disk.
  if (terminal) {
    const buf = await readBlob(row.storageKey);
    await deleteBlob(row.storageKey);
    await db.delete(upload).where(eq(upload.id, id));
    return new Response(new Uint8Array(buf), { headers });
  }

  const nodeStream = readBlobStream(row.storageKey);
  const webStream = Readable.toWeb(nodeStream) as ReadableStream<Uint8Array>;
  return new Response(webStream, { headers });
}
