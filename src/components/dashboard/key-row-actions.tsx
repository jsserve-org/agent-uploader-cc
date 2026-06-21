"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

export function RevokeKeyButton({ id }: { id: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function revoke() {
    if (!confirm("Revoke this key? Pending agents will no longer be able to upload.")) {
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`/api/keys/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        toast.error(data.error ?? "Failed to revoke.");
        return;
      }
      toast.success("Key revoked.");
      router.refresh();
    } catch {
      toast.error("Network error.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Button
      variant="ghost"
      size="sm"
      className="text-destructive hover:text-destructive"
      onClick={revoke}
      disabled={loading}
    >
      Revoke
    </Button>
  );
}
