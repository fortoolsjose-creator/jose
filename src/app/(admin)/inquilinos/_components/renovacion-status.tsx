"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { formatDate } from "@/app/_lib/format";
import { marcarRenovacionContestada } from "../actions";

export function RenovacionStatus({
  leaseId,
  sentAt,
  deadline,
  respondedAt,
}: {
  leaseId: string;
  sentAt: string | null;
  deadline: string | null;
  respondedAt: string | null;
}) {
  const [pending, start] = useTransition();
  const router = useRouter();

  if (!sentAt) return null;

  if (respondedAt) {
    return (
      <p className="text-sm text-emerald-700">
        ✓ Renovación contestada el {formatDate(respondedAt)}.
      </p>
    );
  }

  function marcar() {
    start(async () => {
      const res = await marcarRenovacionContestada(leaseId);
      if (res.error) toast.error(res.error);
      else {
        toast.success("Marcada como contestada");
        router.refresh();
      }
    });
  }

  return (
    <div className="flex flex-wrap items-center gap-3 rounded-lg bg-amber-500/10 p-2.5 text-sm">
      <span className="text-amber-800">
        Carta enviada el {formatDate(sentAt)}
        {deadline && ` · esperando respuesta (límite ${formatDate(deadline)})`}
      </span>
      <Button size="sm" variant="outline" onClick={marcar} disabled={pending}>
        {pending ? "…" : "Marcar contestada"}
      </Button>
    </div>
  );
}
