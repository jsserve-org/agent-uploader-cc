import { NextResponse } from "next/server";
import { and, eq, sql } from "drizzle-orm";
import { nanoid } from "nanoid";
import { db } from "@/db";
import { uploadKey, upload } from "@/db/schema";
import { extractToken, hashToken } from "@/lib/keys";
import { writeBlob, deleteBlob } from "@/lib/storage";
import { env } from "@/env";

export const runtime = "nodejs";
// Allow large request bodies (APKs etc.).
export const maxDuration = 300;

function err(status: number, message: string) {
  return NextResponse.json({ ok: false, error: message }, { status });
}

export async function POST(req: Request) {
  const token = extractToken(req);
  if (!token) {
    return err(401, "Missing key. Send 'Authorization: Bearer <key>'.");
  }

  // Look up the key by hash and validate it is currently usable.
  const [key] = await db
    .select()
    .from(uploadKey)
    .where(eq(uploadKey.tokenHash, hashToken(token)))
    .limit(1);

  if (!key) return err(401, "Invalid key.");
  if (key.revoked) return err(403, "Key has been revoked.");
  if (key.expiresAt && key.expiresAt.getTime() < Date.now()) {
    return err(403, "Key has expired.");
  }
  if (key.usedCount >= key.maxUses) {
    return err(403, "Key has already been used the maximum number of times.");
  }

  // Atomically claim a use slot so concurrent requests can't over-spend a
  // single-use key. If no row is updated, the key was just exhausted.
  const claimed = await db
    .update(uploadKey)
    .set({ usedCount: sql`${uploadKey.usedCount} + 1` })
    .where(
      and(
        eq(uploadKey.id, key.id),
        eq(uploadKey.revoked, false),
        sql`${uploadKey.usedCount} < ${uploadKey.maxUses}`,
      ),
    )
    .returning({ id: uploadKey.id });

  if (claimed.length === 0) {
    return err(403, "Key has already been used the maximum number of times.");
  }

  // Helper to roll back the claimed use if the upload itself fails.
  const releaseClaim = async () => {
    await db
      .update(uploadKey)
      .set({ usedCount: sql`GREATEST(${uploadKey.usedCount} - 1, 0)` })
      .where(eq(uploadKey.id, key.id));
  };

  try {
    const perKeyCap = key.maxFileBytes ?? Infinity;
    const cap = Math.min(perKeyCap, env.maxUploadBytes);

    let filename = "upload.bin";
    let contentType = "application/octet-stream";
    let data: Buffer;

    const ct = req.headers.get("content-type") ?? "";
    if (ct.includes("multipart/form-data")) {
      const form = await req.formData();
      const file = form.get("file");
      if (!(file instanceof File)) {
        await releaseClaim();
        return err(400, "No 'file' field in multipart form.");
      }
      filename = file.name || filename;
      contentType = file.type || contentType;
      data = Buffer.from(await file.arrayBuffer());
    } else {
      // Raw body upload: filename comes from a header.
      filename =
        req.headers.get("x-filename") ?? req.headers.get("x-file-name") ?? filename;
      contentType = ct || contentType;
      data = Buffer.from(await req.arrayBuffer());
    }

    if (data.byteLength === 0) {
      await releaseClaim();
      return err(400, "Empty file.");
    }
    if (data.byteLength > cap) {
      await releaseClaim();
      return err(
        413,
        `File too large (${data.byteLength} bytes, limit ${cap}).`,
      );
    }

    // Sanitise the display filename; never trust it for the storage path.
    const safeName = filename.replace(/[^\w.\-]+/g, "_").slice(0, 200) || "upload.bin";
    const id = nanoid();
    const storageKey = `${id.slice(0, 2)}/${id}-${safeName}`;

    await writeBlob(storageKey, data);

    const expiresAt = new Date(Date.now() + key.retentionSeconds * 1000);

    try {
      await db.insert(upload).values({
        id,
        keyId: key.id,
        userId: key.userId,
        filename: safeName,
        contentType,
        size: data.byteLength,
        storageKey,
        expiresAt,
      });
    } catch (e) {
      await deleteBlob(storageKey);
      throw e;
    }

    const url = `${env.appUrl.replace(/\/$/, "")}/f/${id}`;
    return NextResponse.json(
      {
        ok: true,
        id,
        url,
        filename: safeName,
        size: data.byteLength,
        contentType,
        expiresAt: expiresAt.toISOString(),
      },
      { status: 201 },
    );
  } catch (e) {
    await releaseClaim();
    console.error("Upload failed:", e);
    return err(500, "Upload failed.");
  }
}
