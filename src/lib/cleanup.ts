import { lt } from "drizzle-orm";
import { db } from "@/db";
import { upload } from "@/db/schema";
import { deleteBlob } from "@/lib/storage";

/**
 * Delete every upload whose retention window has passed, removing both the blob
 * and its metadata row. Returns the number of files reaped. Safe to call
 * repeatedly / concurrently (delete is idempotent).
 */
export async function reapExpiredUploads(now = new Date()): Promise<number> {
  const expired = await db
    .select({ id: upload.id, storageKey: upload.storageKey })
    .from(upload)
    .where(lt(upload.expiresAt, now));

  for (const row of expired) {
    await deleteBlob(row.storageKey);
  }

  if (expired.length > 0) {
    await db.delete(upload).where(lt(upload.expiresAt, now));
  }

  return expired.length;
}
