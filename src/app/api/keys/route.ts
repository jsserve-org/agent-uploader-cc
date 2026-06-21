import { NextResponse } from "next/server";
import { desc, eq } from "drizzle-orm";
import { nanoid } from "nanoid";
import { z } from "zod";
import { db } from "@/db";
import { uploadKey } from "@/db/schema";
import { requireUser } from "@/lib/session";
import { generateToken, hashToken, tokenHint } from "@/lib/keys";
import { buildAgentPrompt } from "@/lib/prompt";

const createSchema = z.object({
  label: z.string().trim().min(1).max(100),
  // retention of the uploaded file, in seconds; 5 min .. 30 days
  retentionSeconds: z
    .number()
    .int()
    .min(300)
    .max(30 * 24 * 3600),
  // 1 = single use (default). Capped to keep keys short-lived.
  maxUses: z.number().int().min(1).max(100).default(1),
  // optional per-key file size cap in megabytes
  maxFileMb: z.number().int().min(1).max(4096).optional(),
  // optional key validity window in hours (how long the key itself is accepted)
  keyTtlHours: z.number().int().min(1).max(24 * 30).optional(),
});

export async function GET() {
  const userRow = await requireUser();
  if (!userRow) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rows = await db
    .select()
    .from(uploadKey)
    .where(eq(uploadKey.userId, userRow.id))
    .orderBy(desc(uploadKey.createdAt));

  return NextResponse.json({ keys: rows });
}

export async function POST(req: Request) {
  const userRow = await requireUser();
  if (!userRow) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid input", details: parsed.error.flatten() },
      { status: 400 },
    );
  }
  const input = parsed.data;

  const token = generateToken();
  const id = nanoid();
  const expiresAt = input.keyTtlHours
    ? new Date(Date.now() + input.keyTtlHours * 3600 * 1000)
    : null;

  await db.insert(uploadKey).values({
    id,
    userId: userRow.id,
    label: input.label,
    tokenHash: hashToken(token),
    tokenHint: tokenHint(token),
    retentionSeconds: input.retentionSeconds,
    maxUses: input.maxUses,
    maxFileBytes: input.maxFileMb ? input.maxFileMb * 1024 * 1024 : null,
    expiresAt,
  });

  const prompt = buildAgentPrompt({
    token,
    retentionSeconds: input.retentionSeconds,
    singleUse: input.maxUses === 1,
  });

  // The raw token is returned exactly once — it is never stored in plaintext.
  return NextResponse.json({ id, token, prompt }, { status: 201 });
}
