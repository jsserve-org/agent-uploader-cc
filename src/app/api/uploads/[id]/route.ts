import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { upload } from "@/db/schema";
import { requireUser } from "@/lib/session";
import { deleteBlob } from "@/lib/storage";

/** Delete an upload (blob + metadata) owned by the current user. */
export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const userRow = await requireUser();
  if (!userRow) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const [row] = await db
    .select({ storageKey: upload.storageKey })
    .from(upload)
    .where(and(eq(upload.id, id), eq(upload.userId, userRow.id)))
    .limit(1);

  if (!row) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  await deleteBlob(row.storageKey);
  await db.delete(upload).where(eq(upload.id, id));

  return NextResponse.json({ ok: true });
}
