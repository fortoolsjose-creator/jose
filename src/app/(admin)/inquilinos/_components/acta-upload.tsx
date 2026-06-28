"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createClient } from "@/app/_lib/supabase/client";
import { setActaPath } from "../actions";

export function ActaUpload({
  leaseId,
  orgId,
  hasEntrega,
  hasVencimiento,
}: {
  leaseId: string;
  orgId: string;
  hasEntrega: boolean;
  hasVencimiento: boolean;
}) {
  const [pending, start] = useTransition();
  const router = useRouter();

  function upload(kind: "entrega" | "vencimiento", file: File | null) {
    if (!file) return;
    if (file.size > 15 * 1024 * 1024) {
      toast.error("El archivo pesa más de 15 MB.");
      return;
    }
    start(async () => {
      try {
        const supabase = createClient();
        const safe = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
        const path = `${orgId}/actas/${leaseId}-${kind}-${crypto.randomUUID()}-${safe}`;
        const { error } = await supabase.storage
          .from("documents")
          .upload(path, file, { upsert: false });
        if (error) {
          toast.error("No se pudo subir el acta.");
          return;
        }
        const r = await setActaPath(leaseId, kind, path);
        if (r.error) toast.error(r.error);
        else {
          toast.success("Acta guardada");
          router.refresh();
        }
      } catch {
        toast.error("No se pudo subir el acta.");
      }
    });
  }

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <div className="space-y-1.5">
        <Label htmlFor="acta-entrega">
          Acta de entrega {hasEntrega && <span className="text-muted-foreground">(reemplazar)</span>}
        </Label>
        <Input
          id="acta-entrega"
          type="file"
          accept="image/*,application/pdf"
          disabled={pending}
          onChange={(e) => upload("entrega", e.target.files?.[0] ?? null)}
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="acta-venc">
          Acta de vencimiento{" "}
          {hasVencimiento && <span className="text-muted-foreground">(reemplazar)</span>}
        </Label>
        <Input
          id="acta-venc"
          type="file"
          accept="image/*,application/pdf"
          disabled={pending}
          onChange={(e) => upload("vencimiento", e.target.files?.[0] ?? null)}
        />
      </div>
    </div>
  );
}
