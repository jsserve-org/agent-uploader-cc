import Link from "next/link";
import { redirect } from "next/navigation";
import { and, desc, eq, gt } from "drizzle-orm";
import { db } from "@/db";
import { upload } from "@/db/schema";
import { getSession } from "@/lib/session";
import { env } from "@/env";
import { qrSvg } from "@/lib/qr";
import { Button } from "@/components/ui/button";
import { SignOutButton } from "@/components/dashboard/sign-out-button";
import { StoreList, type StoreApp } from "@/components/store/store-list";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "App Store · agent-uploader",
  description: "Download and install your uploaded APKs.",
};

export default async function StorePage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const rows = await db
    .select()
    .from(upload)
    .where(
      and(
        eq(upload.userId, session.user.id),
        eq(upload.isApk, true),
        gt(upload.expiresAt, new Date()),
      ),
    )
    .orderBy(desc(upload.createdAt))
    .limit(200);

  const apps: StoreApp[] = rows.map((r) => ({
    id: r.id,
    filename: r.filename,
    size: Number(r.size),
    expiresAt: r.expiresAt.toISOString(),
    createdAt: r.createdAt.toISOString(),
    appPackage: r.appPackage,
    appLabel: r.appLabel,
    appVersionName: r.appVersionName,
    appVersionCode: r.appVersionCode != null ? Number(r.appVersionCode) : null,
    appIcon: r.appIcon,
  }));

  const storeUrl = `${env.appUrl.replace(/\/$/, "")}/store`;
  const qr = await qrSvg(storeUrl);

  return (
    <main className="mx-auto w-full max-w-xl flex-1 px-4 py-6">
      <header className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold tracking-tight">App Store</h1>
          <p className="text-xs text-muted-foreground">{session.user.email}</p>
        </div>
        <div className="flex items-center gap-1">
          <Button asChild variant="ghost" size="sm">
            <Link href="/dashboard">Dashboard</Link>
          </Button>
          <SignOutButton />
        </div>
      </header>

      <details className="mb-6 rounded-2xl border bg-card p-4">
        <summary className="cursor-pointer text-sm font-medium">
          Open this store on your phone
        </summary>
        <div className="mt-4 flex items-center gap-4">
          <div
            className="size-28 shrink-0 overflow-hidden rounded-xl bg-white p-1"
            // qrcode emits a self-contained, trusted SVG
            dangerouslySetInnerHTML={{ __html: qr }}
          />
          <div className="text-sm text-muted-foreground">
            <p>Scan with your phone camera, then log in.</p>
            <p className="mt-2">
              Tap <span className="font-medium text-foreground">Install</span> on
              an app — Android will download the APK and prompt you to install it
              (you may need to allow installs from your browser).
            </p>
          </div>
        </div>
      </details>

      <StoreList apps={apps} />
    </main>
  );
}
