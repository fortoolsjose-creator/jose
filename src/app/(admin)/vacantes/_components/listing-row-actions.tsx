"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Copy, ExternalLink, Eye, EyeOff, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import type { ListingStatus } from "@/app/_lib/types";
import { setListingStatus, deleteListing } from "../actions";

type Result = { ok?: true; error?: string };

export function ListingRowActions({
  id,
  slug,
  status,
}: {
  id: string;
  slug: string | null;
  status: ListingStatus;
}) {
  const [pending, start] = useTransition();
  const router = useRouter();

  function act(fn: () => Promise<Result>) {
    start(async () => {
      const r = await fn();
      if (r?.error) {
        toast.error(r.error);
        return;
      }
      router.refresh();
    });
  }

  const publicUrl =
    slug && typeof window !== "undefined"
      ? `${window.location.origin}/v/${slug}`
      : "";

  return (
    <div className="flex flex-wrap gap-1">
      {status === "published" && slug && (
        <>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              navigator.clipboard.writeText(publicUrl);
              toast.success("Liga copiada");
            }}
          >
            <Copy className="size-4" /> Copiar liga
          </Button>
          <Button variant="ghost" size="sm" onClick={() => window.open(publicUrl, "_blank")}>
            <ExternalLink className="size-4" />
          </Button>
        </>
      )}
      {status !== "published" && status !== "filled" && (
        <Button size="sm" disabled={pending} onClick={() => act(() => setListingStatus(id, "published"))}>
          <Eye className="size-4" /> Publicar
        </Button>
      )}
      {status === "published" && (
        <Button variant="outline" size="sm" disabled={pending} onClick={() => act(() => setListingStatus(id, "paused"))}>
          <EyeOff className="size-4" /> Pausar
        </Button>
      )}
      <Button variant="ghost" size="sm" disabled={pending} onClick={() => act(() => deleteListing(id))}>
        <Trash2 className="size-4" />
      </Button>
    </div>
  );
}
