"use client";

import { useTransition } from "react";
import { FileWarning } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { generarRequerimientoPago } from "../actions";

export function RequerimientoButton({ leaseId }: { leaseId: string }) {
  const [pending, start] = useTransition();

  function run() {
    start(async () => {
      const res = await generarRequerimientoPago(leaseId);
      if (res.error || !res.pdf) {
        toast.error(res.error ?? "No se pudo generar la carta.");
        return;
      }
      const bin = atob(res.pdf);
      const bytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      const blob = new Blob([bytes], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = res.filename ?? "requerimiento.pdf";
      link.click();
      URL.revokeObjectURL(url);
    });
  }

  return (
    <Button size="sm" variant="outline" disabled={pending} onClick={run}>
      <FileWarning className="size-4" /> {pending ? "Generando…" : "Requerimiento de pago (PDF)"}
    </Button>
  );
}
