import { Readable } from "node:stream";
import { eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { upload } from "@/db/schema";
import { readBlobStream, blobExists, deleteBlob } from "@/lib/storage";

export const runtime = "nodejs";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

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

  if (!(await blobExists(row.storageKey))) {
    return new Response("File is missing.", { status: 404 });
  }

  await db
    .update(upload)
    .set({ downloadCount: sql`${upload.downloadCount} + 1` })
    .where(eq(upload.id, id));

  const nodeStream = readBlobStream(row.storageKey);
  const webStream = Readable.toWeb(nodeStream) as ReadableStream<Uint8Array>;

  return new Response(webStream, {
    headers: {
      "Content-Type": row.contentType || "application/octet-stream",
      "Content-Length": String(row.size),
      "Content-Disposition": `attachment; filename="${row.filename}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
