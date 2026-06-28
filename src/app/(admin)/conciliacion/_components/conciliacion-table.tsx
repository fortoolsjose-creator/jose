"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { matchTransaction, unmatchTransaction, deleteTransaction } from "../actions";
import type { BankTx, CandidatePayment } from "@/app/_lib/data/bank";

const fmt = (n: number) => "$" + n.toLocaleString("en-US", { minimumFractionDigits: 2 });

export function ConciliacionTable({
  txs,
  candidates,
}: {
  txs: BankTx[];
  candidates: CandidatePayment[];
}) {
  const [pending, start] = useTransition();
  const router = useRouter();
  const act = (fn: () => Promise<{ error?: string }>) =>
    start(async () => {
      const r = await fn();
      if (r.error) toast.error(r.error);
      else router.refresh();
    });

  if (!txs.length)
    return <p className="text-muted-foreground text-sm">Aún no hay movimientos importados.</p>;

  return (
    <div className="space-y-2">
      {txs.map((t) => {
        const sugeridos = candidates.filter((c) => Math.abs(c.amount - t.monto) <= 2);
        return (
          <div key={t.id} className="flex flex-wrap items-center gap-2 rounded-lg border p-3 text-sm">
            <div className="min-w-0 flex-1">
              <span className="font-medium">{fmt(t.monto)}</span>
              <span className="text-muted-foreground">
                {" "}
                · {t.fecha ?? "—"}
                {t.referencia ? ` · ${t.referencia}` : ""}
              </span>
              {t.concepto && <p className="text-muted-foreground truncate text-xs">{t.concepto}</p>}
            </div>
            {t.matched ? (
              <span className="inline-flex items-center gap-1 text-emerald-600">
                <Check className="size-4" /> {t.matched.tenant}
                <button
                  onClick={() => act(() => unmatchTransaction(t.id))}
                  className="text-muted-foreground hover:text-foreground ml-1"
                  aria-label="Desvincular"
                  disabled={pending}
                >
                  <X className="size-4" />
                </button>
              </span>
            ) : sugeridos.length > 0 ? (
              <select
                className="border-input h-8 rounded-lg border bg-transparent px-2 text-sm"
                defaultValue=""
                disabled={pending}
                onChange={(e) => e.target.value && act(() => matchTransaction(t.id, e.target.value))}
              >
                <option value="">Casar con cobro…</option>
                {sugeridos.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.tenant} · {c.period.slice(0, 7)} · {fmt(c.amount)}
                  </option>
                ))}
              </select>
            ) : (
              <span className="text-muted-foreground text-xs">Sin cobro que cuadre</span>
            )}
            <button
              onClick={() => act(() => deleteTransaction(t.id))}
              className="text-muted-foreground hover:text-destructive"
              aria-label="Eliminar"
              disabled={pending}
            >
              <Trash2 className="size-4" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
