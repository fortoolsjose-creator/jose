"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import type { MaintenanceStatus } from "@/app/_lib/types";
import { changeStatus } from "../actions";

export function StatusControl({
  requestId,
  status,
}: {
  requestId: string;
  status: MaintenanceStatus;
}) {
  const [pending, start] = useTransition();
  const router = useRouter();

  function set(s: MaintenanceStatus) {
    start(async () => {
      const r = await changeStatus(requestId, s);
      if (r?.error) {
        toast.error(r.error);
        return;
      }
      toast.success("Estado actualizado");
      router.refresh();
    });
  }

  return (
    <div className="flex flex-wrap gap-2">
      {status === "recibido" && (
        <Button size="sm" disabled={pending} onClick={() => set("en_proceso")}>
          Marcar en proceso
        </Button>
      )}
      {(status === "recibido" || status === "en_proceso") && (
        <Button size="sm" variant="outline" disabled={pending} onClick={() => set("resuelto")}>
          Marcar resuelto
        </Button>
      )}
      {status === "resuelto" && (
        <Button size="sm" variant="outline" disabled={pending} onClick={() => set("en_proceso")}>
          Reabrir
        </Button>
      )}
      {status !== "cancelado" && status !== "resuelto" && (
        <Button size="sm" variant="ghost" disabled={pending} onClick={() => set("cancelado")}>
          Cancelar
        </Button>
      )}
    </div>
  );
}
