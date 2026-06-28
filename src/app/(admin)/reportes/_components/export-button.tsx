"use client";

import { useTransition } from "react";
import { Download } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { exportReportesXlsx } from "../export-actions";

export function ExportButton() {
  const [pending, start] = useTransition();

  function run() {
    start(async () => {
      const res = await exportReportesXlsx();
      if (res.error || !res.base64) {
        toast.error(res.error ?? "No se pudo generar el Excel.");
        return;
      }
      const bin = atob(res.base64);
      const bytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      const blob = new Blob([bytes], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = res.filename ?? "reportes.xlsx";
      link.click();
      URL.revokeObjectURL(url);
    });
  }

  return (
    <Button size="sm" variant="outline" onClick={run} disabled={pending}>
      <Download className="size-4" /> {pending ? "Generando…" : "Exportar a Excel"}
    </Button>
  );
}
