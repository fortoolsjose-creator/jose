import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { History } from "lucide-react";
import { getProfile } from "@/app/_lib/dal";
import { listAuditLog, AUDIT_TABLE_LABELS } from "@/app/_lib/data/audit";
import { PageHeader } from "@/app/_components/page-header";
import { EmptyState } from "@/app/_components/empty-state";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatDate } from "@/app/_lib/format";

export const metadata: Metadata = { title: "Bitácora" };

const MONEY_FIELDS = new Set([
  "amount_paid",
  "amount_due",
  "rent_amount",
  "maintenance_fee",
  "amount",
]);

function val(v: unknown): string {
  if (v === null || v === undefined || v === "") return "—";
  return String(v);
}

/** Resume el diff en frases cortas "campo: antes → después". */
function summarize(entry: { action: string; diff: AuditEntryDiff }): string[] {
  if (!entry.diff) return [];
  if (entry.action === "delete") return ["Registro eliminado"];
  const out: string[] = [];
  for (const [field, change] of Object.entries(entry.diff)) {
    if (field === "updated_at") continue;
    const c = change as { antes?: unknown; despues?: unknown };
    if (typeof c === "object" && c && "despues" in c) {
      const label = MONEY_FIELDS.has(field) ? `$${val(c.antes)} → $${val(c.despues)}` : `${val(c.antes)} → ${val(c.despues)}`;
      out.push(`${field}: ${label}`);
    }
  }
  return out.slice(0, 6);
}

type AuditEntryDiff = Record<string, { antes?: unknown; despues?: unknown }> | Record<string, unknown> | null;

export default async function BitacoraPage() {
  const profile = await getProfile();
  if (profile?.role !== "owner") redirect("/panel");
  const entries = await listAuditLog(100);

  return (
    <>
      <PageHeader
        title="Bitácora"
        subtitle="Quién cambió o borró cobros, gastos, contratos y cuotas — con el antes y el después."
      />

      {entries.length === 0 ? (
        <EmptyState
          icon={History}
          title="Sin movimientos todavía"
          description="Cuando alguien edite o borre un cobro, gasto, contrato o cuota, aquí queda registrado."
        />
      ) : (
        <div className="space-y-2">
          {entries.map((e) => {
            const cambios = summarize(e);
            return (
              <Card key={e.id}>
                <CardContent className="py-3">
                  <div className="flex flex-wrap items-center gap-2 text-sm">
                    <Badge variant={e.action === "delete" ? "destructive" : "secondary"}>
                      {e.action === "delete" ? "Eliminó" : "Modificó"}
                    </Badge>
                    <span className="font-medium">
                      {AUDIT_TABLE_LABELS[e.table_name] ?? e.table_name}
                    </span>
                    <span className="text-muted-foreground">
                      · {e.actorName ?? "Sistema"} · {formatDate(e.created_at.slice(0, 10))}
                    </span>
                  </div>
                  {cambios.length > 0 && (
                    <ul className="text-muted-foreground mt-1.5 space-y-0.5 text-xs">
                      {cambios.map((c, i) => (
                        <li key={i} className="font-mono">
                          {c}
                        </li>
                      ))}
                    </ul>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </>
  );
}
