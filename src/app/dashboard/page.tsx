import Link from "next/link";
import { redirect } from "next/navigation";
import { and, desc, eq, gte, sql } from "drizzle-orm";
import { db } from "@/db";
import { uploadKey, upload, downloadEvent } from "@/db/schema";
import { getSession } from "@/lib/session";
import { env } from "@/env";
import { formatBytes, relativeTime } from "@/lib/format";
import { humanizeDuration } from "@/lib/prompt";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { CreateKeyDialog } from "@/components/dashboard/create-key-dialog";
import { RevokeKeyButton } from "@/components/dashboard/key-row-actions";
import { DeleteUploadButton } from "@/components/dashboard/upload-row-actions";
import { SignOutButton } from "@/components/dashboard/sign-out-button";
import { CopyButton } from "@/components/copy-button";

// Always reflect the latest keys/uploads.
export const dynamic = "force-dynamic";

function keyStatus(k: {
  revoked: boolean;
  expiresAt: Date | null;
  usedCount: number;
  maxUses: number;
}) {
  if (k.revoked) return { label: "Revoked", variant: "secondary" as const };
  if (k.expiresAt && k.expiresAt.getTime() < Date.now())
    return { label: "Expired", variant: "secondary" as const };
  if (k.usedCount >= k.maxUses)
    return { label: "Used up", variant: "secondary" as const };
  return { label: "Active", variant: "default" as const };
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <Card>
      <CardContent className="py-5">
        <div className="text-2xl font-semibold tabular-nums">{value}</div>
        <div className="text-sm text-muted-foreground">{label}</div>
      </CardContent>
    </Card>
  );
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ folder?: string }>;
}) {
  const session = await getSession();
  if (!session) redirect("/login");
  const userId = session.user.id;
  const { folder: activeFolder } = await searchParams;

  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 3600 * 1000);

  const [keys, totals, recentDownloads, folderRows] = await Promise.all([
    db
      .select()
      .from(uploadKey)
      .where(eq(uploadKey.userId, userId))
      .orderBy(desc(uploadKey.createdAt)),
    db
      .select({
        files: sql<number>`count(*)::int`,
        downloads: sql<number>`coalesce(sum(${upload.downloadCount}), 0)::int`,
        bytes: sql<number>`coalesce(sum(${upload.size}), 0)::bigint`,
      })
      .from(upload)
      .where(eq(upload.userId, userId)),
    db
      .select({ n: sql<number>`count(*)::int` })
      .from(downloadEvent)
      .where(
        and(
          eq(downloadEvent.userId, userId),
          gte(downloadEvent.createdAt, sevenDaysAgo),
        ),
      ),
    db
      .selectDistinct({ folder: upload.folder })
      .from(upload)
      .where(eq(upload.userId, userId)),
  ]);

  const uploads = await db
    .select()
    .from(upload)
    .where(
      activeFolder
        ? and(eq(upload.userId, userId), eq(upload.folder, activeFolder))
        : eq(upload.userId, userId),
    )
    .orderBy(desc(upload.createdAt))
    .limit(100);

  const stats = totals[0] ?? { files: 0, downloads: 0, bytes: 0 };
  const last7d = recentDownloads[0]?.n ?? 0;
  const folders = folderRows
    .map((r) => r.folder)
    .filter((f): f is string => Boolean(f))
    .sort();

  const uploadEndpoint = `${env.appUrl.replace(/\/$/, "")}/api/upload`;

  return (
    <main className="mx-auto w-full max-w-5xl flex-1 px-6 py-8">
      <header className="mb-8 flex items-center justify-between">
        <div>
          <Link
            href="/"
            className="font-mono text-sm font-semibold tracking-tight"
          >
            agent-uploader
          </Link>
          <p className="text-sm text-muted-foreground">{session.user.email}</p>
        </div>
        <div className="flex items-center gap-1">
          <Button asChild variant="outline" size="sm">
            <Link href="/store">App Store</Link>
          </Button>
          <SignOutButton />
        </div>
      </header>

      <section className="mb-8 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Stat label="Files held" value={String(stats.files)} />
        <Stat label="Total downloads" value={String(stats.downloads)} />
        <Stat label="Downloads · 7d" value={String(last7d)} />
        <Stat label="Storage used" value={formatBytes(Number(stats.bytes))} />
      </section>

      <Card className="mb-8">
        <CardHeader>
          <CardTitle className="text-base">Upload endpoint</CardTitle>
          <CardDescription>
            Agents POST files here with their key as a bearer token.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2">
            <code className="flex-1 truncate rounded-md bg-muted px-3 py-2 font-mono text-xs">
              {uploadEndpoint}
            </code>
            <CopyButton value={uploadEndpoint} label="URL" />
          </div>
        </CardContent>
      </Card>

      <section className="mb-10">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold">Keys</h2>
            <p className="text-sm text-muted-foreground">
              Each key carries its own retention window, limits, and policies.
            </p>
          </div>
          <CreateKeyDialog />
        </div>

        {keys.length === 0 ? (
          <Card>
            <CardContent className="py-10 text-center text-sm text-muted-foreground">
              No keys yet. Create one to get a paste-ready agent prompt.
            </CardContent>
          </Card>
        ) : (
          <div className="rounded-xl border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Label</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Retention</TableHead>
                  <TableHead>Uses</TableHead>
                  <TableHead>Policies</TableHead>
                  <TableHead>Key</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {keys.map((k) => {
                  const status = keyStatus(k);
                  const active = status.label === "Active";
                  return (
                    <TableRow key={k.id}>
                      <TableCell className="font-medium">{k.label}</TableCell>
                      <TableCell>
                        <Badge variant={status.variant}>{status.label}</Badge>
                      </TableCell>
                      <TableCell>
                        {humanizeDuration(k.retentionSeconds)}
                      </TableCell>
                      <TableCell>
                        {k.usedCount}/{k.maxUses}
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {k.defaultFolder && (
                            <Badge variant="outline">📁 {k.defaultFolder}</Badge>
                          )}
                          {k.allowedTypes && (
                            <Badge variant="outline">types</Badge>
                          )}
                          {k.maxDownloads != null && (
                            <Badge variant="outline">
                              ≤{k.maxDownloads} dl
                            </Badge>
                          )}
                          {k.downloadPasswordHash && (
                            <Badge variant="outline">🔒</Badge>
                          )}
                          {k.webhookUrl && (
                            <Badge variant="outline">webhook</Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="font-mono text-xs text-muted-foreground">
                        …{k.tokenHint}
                      </TableCell>
                      <TableCell className="text-right">
                        {active && <RevokeKeyButton id={k.id} />}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </section>

      <section>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold">Uploads</h2>
            <p className="text-sm text-muted-foreground">
              Files currently held. Each disappears when its window closes.
            </p>
          </div>
          {folders.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5">
              <Button
                asChild
                size="sm"
                variant={activeFolder ? "outline" : "default"}
              >
                <Link href="/dashboard">All</Link>
              </Button>
              {folders.map((f) => (
                <Button
                  key={f}
                  asChild
                  size="sm"
                  variant={activeFolder === f ? "default" : "outline"}
                >
                  <Link href={`/dashboard?folder=${encodeURIComponent(f)}`}>
                    {f}
                  </Link>
                </Button>
              ))}
            </div>
          )}
        </div>

        {uploads.length === 0 ? (
          <Card>
            <CardContent className="py-10 text-center text-sm text-muted-foreground">
              {activeFolder
                ? `Nothing in “${activeFolder}”.`
                : "Nothing uploaded yet."}
            </CardContent>
          </Card>
        ) : (
          <div className="rounded-xl border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>File</TableHead>
                  <TableHead>Folder</TableHead>
                  <TableHead>Size</TableHead>
                  <TableHead>Downloads</TableHead>
                  <TableHead>Expires</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {uploads.map((u) => {
                  const url = `${env.appUrl.replace(/\/$/, "")}/f/${u.id}`;
                  return (
                    <TableRow key={u.id}>
                      <TableCell className="max-w-[180px] truncate font-medium">
                        {u.passwordHash && (
                          <span title="Password-protected">🔒 </span>
                        )}
                        {u.filename}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {u.folder ?? "—"}
                      </TableCell>
                      <TableCell>{formatBytes(u.size)}</TableCell>
                      <TableCell>
                        {u.downloadCount}
                        {u.maxDownloads != null ? `/${u.maxDownloads}` : ""}
                      </TableCell>
                      <TableCell>{relativeTime(u.expiresAt)}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button asChild variant="ghost" size="sm">
                            <a href={url} target="_blank" rel="noreferrer">
                              Open
                            </a>
                          </Button>
                          <CopyButton value={url} />
                          <DeleteUploadButton id={u.id} />
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </section>
    </main>
  );
}
