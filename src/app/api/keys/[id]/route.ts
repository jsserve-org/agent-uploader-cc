import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { uploadKey } from "@/db/schema";
import { requireUser } from "@/lib/session";

/** Revoke a key. The key row is kept so existing uploads stay attributable. */
export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const userRow = await requireUser();
  if (!userRow) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const updated = await db
    .update(uploadKey)
    .set({ revoked: true })
    .where(and(eq(uploadKey.id, id), eq(uploadKey.userId, userRow.id)))
    .returning({ id: uploadKey.id });

  if (updated.length === 0) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}
