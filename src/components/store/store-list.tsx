"use client";

import { useMemo, useState } from "react";
import { Download, Package, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CopyButton } from "@/components/copy-button";
import { formatBytes, relativeTime } from "@/lib/format";

export type StoreApp = {
  id: string;
  filename: string;
  size: number;
  expiresAt: string;
  createdAt: string;
  appPackage: string | null;
  appLabel: string | null;
  appVersionName: string | null;
  appVersionCode: number | null;
  appIcon: string | null;
};

type Group = {
  key: string;
  label: string;
  pkg: string | null;
  icon: string | null;
  latest: StoreApp;
  older: StoreApp[];
};

function displayName(a: StoreApp): string {
  return a.appLabel ?? a.filename.replace(/\.apk$/i, "");
}

function version(a: StoreApp): string {
  if (a.appVersionName)
    return `v${a.appVersionName}${a.appVersionCode ? ` (${a.appVersionCode})` : ""}`;
  if (a.appVersionCode) return `build ${a.appVersionCode}`;
  return "—";
}

function groupApps(apps: StoreApp[]): Group[] {
  const map = new Map<string, StoreApp[]>();
  for (const a of apps) {
    const key = a.appPackage ?? `file:${a.filename}`;
    (map.get(key) ?? map.set(key, []).get(key)!).push(a);
  }
  const groups: Group[] = [];
  for (const [key, list] of map) {
    // Newest first: by version code, then upload time.
    list.sort(
      (x, y) =>
        (y.appVersionCode ?? 0) - (x.appVersionCode ?? 0) ||
        +new Date(y.createdAt) - +new Date(x.createdAt),
    );
    const latest = list[0];
    groups.push({
      key,
      label: displayName(latest),
      pkg: latest.appPackage,
      icon: list.find((a) => a.appIcon)?.appIcon ?? null,
      latest,
      older: list.slice(1),
    });
  }
  groups.sort(
    (a, b) =>
      +new Date(b.latest.createdAt) - +new Date(a.latest.createdAt),
  );
  return groups;
}

function AppIcon({ icon, label }: { icon: string | null; label: string }) {
  if (icon) {
    // eslint-disable-next-line @next/next/no-img-element
    return (
      <img
        src={icon}
        alt=""
        className="size-14 shrink-0 rounded-2xl border bg-muted object-cover"
      />
    );
  }
  return (
    <div className="flex size-14 shrink-0 items-center justify-center rounded-2xl border bg-muted">
      <Package className="size-6 text-muted-foreground" />
    </div>
  );
}

function InstallButton({ id, label }: { id: string; label: string }) {
  return (
    <Button asChild size="sm" className="gap-1.5">
      <a href={`/f/${id}`} aria-label={`Install ${label}`}>
        <Download className="size-3.5" /> Install
      </a>
    </Button>
  );
}

export function StoreList({ apps }: { apps: StoreApp[] }) {
  const [query, setQuery] = useState("");
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  const groups = useMemo(() => groupApps(apps), [apps]);
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return groups;
    return groups.filter(
      (g) =>
        g.label.toLowerCase().includes(q) ||
        (g.pkg ?? "").toLowerCase().includes(q) ||
        g.latest.filename.toLowerCase().includes(q),
    );
  }, [groups, query]);

  return (
    <div className="space-y-4">
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search apps…"
          className="pl-9"
          inputMode="search"
        />
      </div>

      {filtered.length === 0 ? (
        <p className="py-12 text-center text-sm text-muted-foreground">
          {apps.length === 0
            ? "No APKs yet. Upload one with a key and it shows up here."
            : "No apps match your search."}
        </p>
      ) : (
        <ul className="space-y-3">
          {filtered.map((g) => (
            <li key={g.key} className="rounded-2xl border bg-card p-4">
              <div className="flex items-center gap-4">
                <AppIcon icon={g.icon} label={g.label} />
                <div className="min-w-0 flex-1">
                  <div className="truncate font-semibold">{g.label}</div>
                  <div className="truncate text-xs text-muted-foreground">
                    {g.pkg ?? g.latest.filename}
                  </div>
                  <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
                    <Badge variant="secondary">{version(g.latest)}</Badge>
                    <span>{formatBytes(g.latest.size)}</span>
                    <span>· expires {relativeTime(new Date(g.latest.expiresAt))}</span>
                  </div>
                </div>
                <div className="flex flex-col items-end gap-1.5">
                  <InstallButton id={g.latest.id} label={g.label} />
                  <CopyButton
                    value={`${typeof window !== "undefined" ? window.location.origin : ""}/f/${g.latest.id}`}
                    label="link"
                  />
                </div>
              </div>

              {g.older.length > 0 && (
                <div className="mt-3 border-t pt-2">
                  <button
                    type="button"
                    onClick={() =>
                      setExpanded((s) => ({ ...s, [g.key]: !s[g.key] }))
                    }
                    className="text-xs text-muted-foreground underline underline-offset-4"
                  >
                    {expanded[g.key] ? "Hide" : "Show"} {g.older.length} older
                    build{g.older.length === 1 ? "" : "s"}
                  </button>
                  {expanded[g.key] && (
                    <ul className="mt-2 space-y-2">
                      {g.older.map((o) => (
                        <li
                          key={o.id}
                          className="flex items-center justify-between gap-2 text-sm"
                        >
                          <span className="flex items-center gap-2 text-muted-foreground">
                            <Badge variant="outline">{version(o)}</Badge>
                            {formatBytes(o.size)}
                          </span>
                          <InstallButton id={o.id} label={g.label} />
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
