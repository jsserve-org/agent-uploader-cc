import Link from "next/link";
import { redirect } from "next/navigation";
import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { uploadKey, upload } from "@/db/schema";
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

export default async function DashboardPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  const userId = session.user.id;

  const [keys, uploads] = await Promise.all([
    db
      .select()
      .from(uploadKey)
      .where(eq(uploadKey.userId, userId))
      .orderBy(desc(uploadKey.createdAt)),
    db
      .select()
      .from(upload)
      .where(eq(upload.userId, userId))
      .orderBy(desc(upload.createdAt))
      .limit(50),
  ]);

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
          <p className="text-sm text-muted-foreground">
            {session.user.email}
          </p>
        </div>
        <SignOutButton />
      </header>

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
              Each key carries its own retention window and use limit.
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
        <div className="mb-4">
          <h2 className="text-lg font-semibold">Uploads</h2>
          <p className="text-sm text-muted-foreground">
            Files currently held. Each disappears when its window closes.
          </p>
        </div>

        {uploads.length === 0 ? (
          <Card>
            <CardContent className="py-10 text-center text-sm text-muted-foreground">
              Nothing uploaded yet.
            </CardContent>
          </Card>
        ) : (
          <div className="rounded-xl border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>File</TableHead>
                  <TableHead>Size</TableHead>
                  <TableHead>Downloads</TableHead>
                  <TableHead>Expires</TableHead>
                  <TableHead className="text-right">Link</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {uploads.map((u) => {
                  const url = `${env.appUrl.replace(/\/$/, "")}/f/${u.id}`;
                  return (
                    <TableRow key={u.id}>
                      <TableCell className="max-w-[200px] truncate font-medium">
                        {u.filename}
                      </TableCell>
                      <TableCell>{formatBytes(u.size)}</TableCell>
                      <TableCell>{u.downloadCount}</TableCell>
                      <TableCell>{relativeTime(u.expiresAt)}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Button asChild variant="ghost" size="sm">
                            <a href={url} target="_blank" rel="noreferrer">
                              Open
                            </a>
                          </Button>
                          <CopyButton value={url} />
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
