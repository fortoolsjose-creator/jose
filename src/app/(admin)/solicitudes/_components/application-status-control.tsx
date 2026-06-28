"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import type { ApplicationStatus } from "@/app/_lib/types";
import { setApplicationStatus } from "../actions";

export function ApplicationStatusControl({
  id,
  status,
}: {
  id: string;
  status: ApplicationStatus;
}) {
  const [pending, start] = useTransition();
  const router = useRouter();

  function set(s: ApplicationStatus) {
    start(async () => {
      const r = await setApplicationStatus(id, s);
      if (r?.error) {
        toast.error(r.error);
        return;
      }
      toast.success("Actualizado");
      router.refresh();
    });
  }

  return (
    <div className="flex flex-wrap gap-2">
      {status === "recibida" && (
        <Button size="sm" variant="outline" disabled={pending} onClick={() => set("en_revision")}>
          Marcar en revisión
        </Button>
      )}
      {status !== "rechazada" && status !== "aprobada" && (
        <Button size="sm" variant="ghost" disabled={pending} onClick={() => set("rechazada")}>
          Rechazar
        </Button>
      )}
      {status === "rechazada" && (
        <Button size="sm" variant="outline" disabled={pending} onClick={() => set("en_revision")}>
          Reabrir
        </Button>
      )}
    </div>
  );
}
