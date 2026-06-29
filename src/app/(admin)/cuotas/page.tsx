import type { Metadata } from "next";
import { CircleDollarSign } from "lucide-react";
import {
  ensureCurrentMaintenanceFees,
  listMaintenanceFees,
} from "@/app/_lib/data/maintenance-fees";
import { getMaintenanceFund } from "@/app/_lib/data/maintenance-fund";
import { PageHeader } from "@/app/_components/page-header";
import { EmptyState } from "@/app/_components/empty-state";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatMXN, formatMonth, formatDate } from "@/app/_lib/format";
import { PAYMENT_STATUS_LABELS, type PaymentStatus } from "@/app/_lib/types";
import { RecordFeeDialog } from "./_components/record-fee-dialog";

export const metadata: Metadata = { title: "Cuotas de mantenimiento" };

const STATUS_VARIANT: Record<
  PaymentStatus,
  "default" | "secondary" | "outline" | "destructive"
> = {
  paid: "default",
  pending: "secondary",
  partial: "outline",
  overdue: "destructive",
};

const pad = (n: number) => String(n).padStart(2, "0");

function SummaryCard({ label, value, danger }: { label: string; value: string; danger?: boolean }) {
  return (
    <Card>
      <CardContent className="py-4">
        <p className="text-muted-foreground text-xs">{label}</p>
        <p className={`text-lg font-bold ${danger ? "text-destructive" : ""}`}>{value}</p>
      </CardContent>
    </Card>
  );
}

export default async function CuotasPage() {
  await ensureCurrentMaintenanceFees();
  const now = new Date();
  const period = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-01`;
  const [fees, fund] = await Promise.all([
    listMaintenanceFees({ month: period }),
    getMaintenanceFund(),
  ]);

  const cobrado = fees.reduce((s, f) => s + Number(f.amount_paid), 0);
  const totalMes = fees.reduce((s, f) => s + Number(f.amount_due), 0);
  const porCobrar = fees.reduce(
    (s, f) => s + Math.max(0, Number(f.amount_due) - Number(f.amount_paid)),
    0,
  );

  return (
    <>
      <PageHeader
        title="Cuotas de mantenimiento"
        subtitle={`Cargo mensual aparte de la renta · ${formatMonth(period)}`}
      />

      {fund.rows.length > 0 && (
        <div className="mb-8">
          <h2 className="text-lg font-semibold">Fondo de mantenimiento</h2>
          <p className="text-muted-foreground mb-3 text-sm">
            El colchón de cada edificio: saldo base + cuotas cobradas − gastos de mantenimiento.
          </p>
          <div className="mb-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
            <SummaryCard label="Fondo actual (total)" value={formatMXN(fund.totals.fondoAcum)} danger={fund.totals.fondoAcum < 0} />
            <SummaryCard label="Saldo base (provisional)" value={formatMXN(fund.totals.base)} />
            <SummaryCard label="Movimiento del mes" value={formatMXN(fund.totals.fondoMes)} danger={fund.totals.fondoMes < 0} />
          </div>
          <Card><CardContent className="px-0 py-0">
            <div className="divide-y text-sm">
              <div className="text-muted-foreground grid grid-cols-12 gap-2 px-4 py-2 text-xs font-medium">
                <span className="col-span-4">Edificio</span>
                <span className="col-span-2 text-right">Saldo base</span>
                <span className="col-span-2 text-right">Cobrado mes</span>
                <span className="col-span-2 text-right">Gasto mes</span>
                <span className="col-span-2 text-right">Fondo actual</span>
              </div>
              {fund.rows.map((r) => (
                <div key={r.property_id} className="grid grid-cols-12 items-center gap-2 px-4 py-2.5">
                  <span className="col-span-4 truncate font-medium">{r.name}</span>
                  <span className="text-muted-foreground col-span-2 text-right">{formatMXN(r.base)}</span>
                  <span className="col-span-2 text-right">{formatMXN(r.ingresoMes)}</span>
                  <span className="text-muted-foreground col-span-2 text-right">{formatMXN(r.egresoMes)}</span>
                  <span className={`col-span-2 text-right font-medium ${r.fondoAcum < 0 ? "text-destructive" : ""}`}>{formatMXN(r.fondoAcum)}</span>
                </div>
              ))}
            </div>
          </CardContent></Card>
          {fund.hasProvisional && (
            <p className="text-muted-foreground mt-2 text-xs">
              Saldo base = corte Mayo 2026 (provisional, por ajustar con la asistente).
            </p>
          )}
          {fund.sinAsignar > 0 && (
            <p className="text-muted-foreground mt-2 text-xs">
              {formatMXN(fund.sinAsignar)} en gastos de mantenimiento sin edificio asignado (no entran a ningún fondo).
            </p>
          )}
        </div>
      )}

      {fees.length === 0 ? (
        <EmptyState
          icon={CircleDollarSign}
          title="Sin cuotas este mes"
          description="Define la cuota mensual en el contrato de cada arrendatario (Arrendatarios → un arrendatario → Contrato → «Cuota de mantenimiento»). Aquí aparecerán automáticamente cada mes."
        />
      ) : (
        <>
          <div className="mb-6 grid grid-cols-3 gap-3">
            <SummaryCard label="Cobrado (mes)" value={formatMXN(cobrado)} />
            <SummaryCard label="Por cobrar (mes)" value={formatMXN(porCobrar)} danger={porCobrar > 0} />
            <SummaryCard label="Total cuotas (mes)" value={formatMXN(totalMes)} />
          </div>

          <div className="space-y-3">
            {fees.map((f) => {
              const tenant =
                f.lease?.tenant?.full_name ?? f.lease?.tenant?.email ?? "Arrendatario";
              const unit = [f.lease?.unit?.property?.name, f.lease?.unit?.label]
                .filter(Boolean)
                .join(" · ");
              return (
                <Card key={f.id}>
                  <CardContent className="flex flex-wrap items-center justify-between gap-3 py-4">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-medium">{tenant}</span>
                        <Badge variant={STATUS_VARIANT[f.status]}>
                          {PAYMENT_STATUS_LABELS[f.status]}
                        </Badge>
                      </div>
                      <p className="text-muted-foreground text-sm">
                        {[
                          unit,
                          formatMXN(f.amount_due),
                          f.due_date && `vence ${formatDate(f.due_date)}`,
                          f.paid_date && `pagado ${formatDate(f.paid_date)}`,
                        ]
                          .filter(Boolean)
                          .join(" · ")}
                      </p>
                    </div>
                    {f.status !== "paid" && (
                      <RecordFeeDialog feeId={f.id} amountDue={Number(f.amount_due)} />
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </>
      )}
    </>
  );
}
