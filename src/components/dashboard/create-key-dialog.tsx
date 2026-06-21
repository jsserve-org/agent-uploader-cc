"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { CopyButton } from "@/components/copy-button";

const RETENTIONS = [
  { label: "1 hour", value: 3600 },
  { label: "6 hours", value: 6 * 3600 },
  { label: "24 hours", value: 24 * 3600 },
  { label: "3 days", value: 3 * 24 * 3600 },
  { label: "7 days", value: 7 * 24 * 3600 },
];

type Created = { id: string; token: string; prompt: string };

export function CreateKeyDialog() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [created, setCreated] = useState<Created | null>(null);

  const [label, setLabel] = useState("");
  const [retention, setRetention] = useState(String(24 * 3600));
  const [maxUses, setMaxUses] = useState("1");

  function reset() {
    setCreated(null);
    setLabel("");
    setRetention(String(24 * 3600));
    setMaxUses("1");
  }

  async function submit() {
    if (!label.trim()) {
      toast.error("Give the key a label.");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          label: label.trim(),
          retentionSeconds: Number(retention),
          maxUses: Number(maxUses),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? "Failed to create key.");
        return;
      }
      setCreated(data as Created);
      router.refresh();
    } catch {
      toast.error("Network error.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (!o) reset();
      }}
    >
      <DialogTrigger render={<Button>New key</Button>} />
      <DialogContent className="sm:max-w-lg">
        {!created ? (
          <>
            <DialogHeader>
              <DialogTitle>Create an upload key</DialogTitle>
              <DialogDescription>
                The key and a ready-to-paste agent prompt are shown once, right
                after creation.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div className="space-y-2">
                <Label htmlFor="label">Label</Label>
                <Input
                  id="label"
                  value={label}
                  onChange={(e) => setLabel(e.target.value)}
                  placeholder="Nightly APK build"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>File expires after</Label>
                  <Select
                    value={retention}
                    onValueChange={(v) => setRetention(v ?? "")}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {RETENTIONS.map((r) => (
                        <SelectItem key={r.value} value={String(r.value)}>
                          {r.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Allowed uploads</Label>
                  <Select
                    value={maxUses}
                    onValueChange={(v) => setMaxUses(v ?? "")}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1">1 (single use)</SelectItem>
                      <SelectItem value="3">3</SelectItem>
                      <SelectItem value="10">10</SelectItem>
                      <SelectItem value="25">25</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button onClick={submit} disabled={loading}>
                {loading ? "Creating…" : "Create key"}
              </Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>Key created</DialogTitle>
              <DialogDescription>
                Copy these now — the raw key is never shown again.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div className="space-y-2">
                <Label>Single-use key</Label>
                <div className="flex items-center gap-2">
                  <code className="flex-1 truncate rounded-md bg-muted px-3 py-2 font-mono text-xs">
                    {created.token}
                  </code>
                  <CopyButton value={created.token} label="key" />
                </div>
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Agent prompt</Label>
                  <CopyButton value={created.prompt} label="prompt" />
                </div>
                <pre className="max-h-64 overflow-auto rounded-md bg-muted p-3 font-mono text-xs whitespace-pre-wrap">
                  {created.prompt}
                </pre>
              </div>
            </div>
            <DialogFooter>
              <Button
                onClick={() => {
                  setOpen(false);
                  reset();
                }}
              >
                Done
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
