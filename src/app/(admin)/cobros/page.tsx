import type { Metadata, Route } from "next";
import Link from "next/link";
import { AlertTriangle, Banknote } from "lucide-react";
import {
  ensureCurrentPayments,
  listPayments,
  listPaymentMonths,
} from "@/app/_lib/data/payments";
import { getCollectionSummary, listDebtors, daysOverdue, getMoraConfig } from "@/app/_lib/data/finance";
import { MoraConfigForm } from "./_components/mora-config-form";
import { getProfile } from "@/app/_lib/dal";
import { PageHeader } from "@/app/_components/page-header";
import { SortSelect, type SortOption } from "@/app/_components/sort-select";
import { dateAsc, dateDesc } from "@/app/_lib/sort";
import { ProofButton } from "@/app/_components/proof-button";
import { EmptyState } from "@/app/_components/empty-state";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatMXN, formatMonth, formatDate } from "@/app/_lib/format";
import {
  PAYMENT_STATUS_LABELS,
  PAYMENT_METHOD_LABELS,
  FISCAL_STATUS_LABELS,
  type PaymentStatus,
} from "@/app/_lib/types";
import { PaymentFilters } from "./_components/payment-filters";
import { RecordPaymentDialog } from "./_components/record-payment-dialog";
import { ReceiptButton } from "./_components/receipt-button";
import { SendRemindersButton } from "./_components/send-reminders-button";
import { getProofUrl } from "./actions";

export const metadata: Metadata = { title: "Cobros" };

const STATUS_VARIANT: Record<
  PaymentStatus,
  "default" | "secondary" | "outline" | "destructive"
> = {
  paid: "default",
  pending: "secondary",
  partial: "outline",
  overdue: "destructive",
};

function SummaryCard({
  label,
  value,
  danger,
}: {
  label: string;
  value: string;
  danger?: boolean;
}) {
  return (
    <Card>
      <CardContent className="py-4">
        <p className="text-muted-foreground text-xs">{label}</p>
        <p className={`text-lg font-bold ${danger ? "text-destructive" : ""}`}>{value}</p>
      </CardContent>
    </Card>
  );
}

const OPTS: SortOption[] = [
  { value: "vence_asc", label: "Fecha de vencimiento (más próxima)" },
  { value: "vence_desc", label: "Fecha de vencimiento (más lejana)" },
  { value: "atraso_desc", label: "Días de atraso (mayor a menor)" },
  { value: "atraso_asc", label: "Días de atraso (menor a mayor)" },
  { value: "monto_desc", label: "Monto (mayor a menor)" },
  { value: "monto_asc", label: "Monto (menor a mayor)" },
  { value: "pago_desc", label: "Fecha de pago (más reciente)" },
  { value: "pago_asc", label: "Fecha de pago (más antigua)" },
  { value: "estado", label: "Estado (vencido primero)" },
];
const STATUS_ORDER: Record<string, number> = { overdue: 0, pending: 1, partial: 2, paid: 3 };

export default async function CobrosPage(props: {
  searchParams: Promise<{ month?: string; status?: string; orden?: string }>;
}) {
  await ensureCurrentPayments();
  const sp = await props.searchParams;
  const monthValues = await listPaymentMonths();
  const months = monthValues.map((m) => ({ value: m, label: formatMonth(m) }));
  const month = sp.month ?? monthValues[0];
  const orden = OPTS.some((o) => o.value === sp.orden) ? sp.orden! : "vence_asc";
  const [paymentsRaw, summary, debtors, profile, moraCfg] = await Promise.all([
    listPayments({ month, status: sp.status }),
    getCollectionSummary(),
    listDebtors(),
    getProfile(),
    getMoraConfig(),
  ]);
  const orgId = profile?.org_id ?? "";
  const isOwner = profile?.role === "owner";
  const payments = [...paymentsRaw].sort((a, b) => {
    switch (orden) {
      case "vence_desc": return dateDesc(a.due_date, b.due_date);
      case "atraso_desc": return daysOverdue(b.due_date) - daysOverdue(a.due_date);
      case "atraso_asc": return daysOverdue(a.due_date) - daysOverdue(b.due_date);
      case "monto_desc": return Number(b.amount_due) - Number(a.amount_due);
      case "monto_asc": return Number(a.amount_due) - Number(b.amount_due);
      case "pago_desc": return dateDesc(a.paid_date, b.paid_date);
      case "pago_asc": return dateAsc(a.paid_date, b.paid_date);
      case "estado": return (STATUS_ORDER[a.status] ?? 9) - (STATUS_ORDER[b.status] ?? 9);
      default: return dateAsc(a.due_date, b.due_date);
    }
  });

  return (
    <>
      <PageHeader
        title="Cobros"
        subtitle="Quién debe, quién pagó y el recibo de cada pago."
        action={<SendRemindersButton />}
      />

      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <SummaryCard label="Cobrado (mes)" value={formatMXN(summary.cobrado)} />
        <SummaryCard label="Por cobrar (mes)" value={formatMXN(summary.porCobrar)} />
        <SummaryCard label="Vencido (total)" value={formatMXN(summary.vencidoTotal)} danger={summary.vencidoTotal > 0} />
        <SummaryCard label="Cobranza" value={`${Math.round(summary.pctCobranza * 100)}%`} />
      </div>

      {isOwner && (
        <div className="mb-6">
          <h2 className="text-muted-foreground mb-2 text-sm font-semibold">Cargo moratorio</h2>
          <MoraConfigForm tasa={moraCfg.tasa} gracia={moraCfg.gracia} />
        </div>
      )}

      {debtors.length > 0 && (
        <div className="mb-6">
          <h2 className="mb-2 flex items-center gap-2 text-lg font-semibold">
            <AlertTriangle className="text-destructive size-4" /> Cartera vencida
          </h2>
          <div className="space-y-2">
            {debtors.slice(0, 6).map((d) => (
              <Link key={d.lease_id} href={`/inquilinos/${d.lease_id}` as Route} className="block">
                <Card className="hover:border-foreground/20 transition">
                  <CardContent className="flex items-center justify-between gap-3 py-3">
                    <div className="min-w-0">
                      <p className="truncate font-medium">{d.tenant}</p>
                      <p className="text-muted-foreground text-sm">
                        {[d.unit, `${d.diasAtraso} días de atraso`].filter(Boolean).join(" · ")}
                      </p>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="text-destructive font-semibold">{formatMXN(d.saldoVencido)}</p>
                      {d.moraCalculada > 0 && (
                        <p className="text-muted-foreground text-xs">
                          + mora {formatMXN(d.moraCalculada)}
                        </p>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        </div>
      )}

      {months.length > 0 && (
        <div className="mb-4">
          <PaymentFilters months={months} />
        </div>
      )}

      {payments.length > 0 && (
        <div className="mb-4">
          <SortSelect options={OPTS} current={orden} />
        </div>
      )}

      {payments.length === 0 ? (
        <EmptyState
          icon={Banknote}
          title="Sin pagos en este filtro"
          description="Cuando tengas contratos activos, cada mes aparecerá aquí la renta de cada arrendatario, con su estado y recibo."
        />
      ) : (
        <div className="space-y-3">
          {payments.map((p) => {
            const tenantName =
              p.lease?.tenant?.full_name ?? p.lease?.tenant?.email ?? "Arrendatario";
            const unitLabel = [p.lease?.unit?.property?.name, p.lease?.unit?.label]
              .filter(Boolean)
              .join(" · ");
            const pendingConfirm = !!p.tenant_marked_paid_at && p.status !== "paid";

            return (
              <Card key={p.id}>
                <CardContent className="flex flex-wrap items-center justify-between gap-3 py-4">
                  <div className="min-w-0 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium">{tenantName}</span>
                      <Badge variant={STATUS_VARIANT[p.status]}>
                        {PAYMENT_STATUS_LABELS[p.status]}
                      </Badge>
                      {pendingConfirm && (
                        <Badge variant="outline">Marcado por el arrendatario</Badge>
                      )}
                      {p.status === "paid" && (
                        <Badge
                          variant={
                            p.fiscal_status === "con_factura"
                              ? "default"
                              : p.fiscal_status === "sin_factura"
                                ? "secondary"
                                : "outline"
                          }
                        >
                          {FISCAL_STATUS_LABELS[p.fiscal_status]}
                        </Badge>
                      )}
                    </div>
                    <p className="text-muted-foreground text-sm">
                      {[
                        unitLabel,
                        formatMonth(p.period_month),
                        formatMXN(p.amount_due),
                        p.due_date && `vence ${formatDate(p.due_date)}`,
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </p>
                    {pendingConfirm && p.tenant_reference && (
                      <p className="text-muted-foreground text-xs">
                        Clave SPEI del arrendatario:{" "}
                        <span className="font-mono">{p.tenant_reference}</span>
                      </p>
                    )}
                    {p.status === "paid" && (
                      <p className="text-muted-foreground text-xs">
                        {[
                          p.paid_date && `Pagado ${formatDate(p.paid_date)}`,
                          p.method && PAYMENT_METHOD_LABELS[p.method],
                          p.reference,
                          p.recibio?.full_name && `Recibió ${p.recibio.full_name}`,
                        ]
                          .filter(Boolean)
                          .join(" · ")}
                      </p>
                    )}
                  </div>
                  <div className="flex shrink-0 gap-1">
                    {p.proof_path && <ProofButton path={p.proof_path} getUrl={getProofUrl} />}
                    {p.status !== "paid" && (
                      <RecordPaymentDialog
                        paymentId={p.id}
                        amountDue={Number(p.amount_due)}
                        amountPaid={Number(p.amount_paid)}
                        suggestedReference={p.tenant_reference}
                        orgId={orgId}
                      />
                    )}
                    {p.receipt_pdf_url && <ReceiptButton path={p.receipt_pdf_url} />}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </>
  );
}
