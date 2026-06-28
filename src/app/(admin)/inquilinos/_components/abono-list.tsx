"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { X } from "lucide-react";
import { toast } from "sonner";
import { formatMXN, formatDate } from "@/app/_lib/format";
import { deleteAllocation } from "@/app/(admin)/cobros/actions";
import type { Abono } from "@/app/_lib/data/finance";

/** Desglose de abonos de un cobro (solo si hubo más de uno), con opción de borrar. */
export function AbonoList({ abonos }: { abonos: Abono[] }) {
  const [pending, start] = useTransition();
  const router = useRouter();
  if (abonos.length <= 1) return null;

  return (
    <ul className="mt-1 space-y-0.5">
      {abonos.map((a) => (
        <li key={a.id} className="text-muted-foreground flex items-center gap-2 text-xs">
          <span>
            Abono {formatMXN(a.monto)}
            {a.fecha ? ` · ${formatDate(a.fecha)}` : ""}
            {a.reference ? ` · ${a.reference}` : ""}
          </span>
          <button
            onClick={() =>
              start(async () => {
                const r = await deleteAllocation(a.id);
                if (r.error) toast.error(r.error);
                else router.refresh();
              })
            }
            disabled={pending}
            className="hover:text-destructive"
            aria-label="Borrar abono"
          >
            <X className="size-3" />
          </button>
        </li>
      ))}
    </ul>
  );
}
