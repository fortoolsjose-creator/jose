import type { Metadata } from "next";
import { Banknote } from "lucide-react";
import {
  ensureTenantCurrentPayment,
  getTenantPayments,
  getTenantLease,
  tenantAccountSummary,
} from "@/app/_lib/data/tenant";
import { PageHeader } from "@/app/_components/page-header";
import { EmptyState } from "@/app/_components/empty-state";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { getProfile } from "@/app/_lib/dal";
import { formatMXN, formatMonth, formatDate } from "@/app/_lib/format";
import { PAYMENT_STATUS_LABELS, type PaymentStatus } from "@/app/_lib/types";
import { ProofButton } from "@/app/_components/proof-button";
import { MarkPaidDialog } from "./_components/mark-paid-dialog";
import { ClabeCard } from "./_components/clabe-card";
import { ReceiptButton } from "./_components/receipt-button";
import { getProofUrl } from "./actions";

export const metadata: Metadata = { title: "Mi renta" };

const STATUS_VARIANT: Record<
  PaymentStatus,
  "default" | "secondary" | "outline" | "destructive"
> = {
  paid: "default",
  pending: "secondary",
  partial: "outline",
  overdue: "destructive",
};

export default async function MiRentaPage() {
  await ensureTenantCurrentPayment();
  const [payments, profile, lease] = await Promise.all([
    getTenantPayments(),
    getProfile(),
    getTenantLease(),
  ]);
  const summary = tenantAccountSummary(payments);
  const cuenta = lease?.unit?.property;
  const orgId = profile?.org_id ?? "";
  const userId = profile?.id ?? "";
  const next = payments
    .filter((p) => p.status !== "paid")
    .sort((a, b) => ((a.due_date ?? "") < (b.due_date ?? "") ? -1 : 1))[0];

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <PageHeader title="Mi renta" subtitle="Tu próximo pago y tu historial." />

      {summary.saldo > 0 && (
        <Card>
          <CardContent className="py-5">
            <p className="text-muted-foreground text-sm">Tu saldo pendiente</p>
            <p className="text-destructive text-3xl font-bold">
              {formatMXN(summary.saldo)}
            </p>
            {summary.pendientes.length > 1 && (
              <ul className="mt-3 space-y-1.5 text-sm">
                {summary.pendientes.map((m) => (
                  <li key={m.period} className="flex justify-between gap-3">
                    <span className="text-muted-foreground">
                      {formatMonth(m.period)}
                      {m.due_date ? ` · vence ${formatDate(m.due_date)}` : ""}
                    </span>
                    <span className="font-medium">{formatMXN(m.saldo)}</span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      )}

      {next ? (
        <Card>
          <CardContent className="py-5">
            <p className="text-muted-foreground text-sm">
              Renta de {formatMonth(next.period_month)}
            </p>
            <p className="text-3xl font-bold">
              {formatMXN(Number(next.amount_due) - Number(next.amount_paid))}
            </p>
            {Number(next.amount_paid) > 0 && (
              <p className="text-muted-foreground text-xs">
                Saldo restante · ya abonaste {formatMXN(Number(next.amount_paid))} de{" "}
                {formatMXN(Number(next.amount_due))}
              </p>
            )}
            <div className="mt-1 flex items-center gap-2">
              <Badge variant={STATUS_VARIANT[next.status]}>
                {PAYMENT_STATUS_LABELS[next.status]}
              </Badge>
              {next.due_date && (
                <span className="text-muted-foreground text-sm">
                  vence {formatDate(next.due_date)}
                </span>
              )}
            </div>
            {next.tenant_marked_paid_at ? (
              <p className="text-muted-foreground mt-4 text-sm">
                Ya avisaste de tu pago
                {next.tenant_reference ? ` (clave ${next.tenant_reference})` : ""}. Tu
                arrendador lo confirmará pronto.
              </p>
            ) : (
              <div className="mt-4">
                <MarkPaidDialog paymentId={next.id} orgId={orgId} userId={userId} />
              </div>
            )}
          </CardContent>
        </Card>
      ) : payments.length === 0 ? (
        <Card>
          <CardContent className="text-muted-foreground py-6 text-center text-sm">
            Aún no tienes una renta asignada. Cuando tu arrendador registre tu
            contrato, aquí verás tu próximo pago.
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="text-muted-foreground py-6 text-center text-sm">
            Estás al corriente con tu renta. 🎉
            {summary.streak > 1 && (
              <span className="block text-foreground mt-1 font-medium">
                Llevas {summary.streak} meses puntuales.
              </span>
            )}
          </CardContent>
        </Card>
      )}

      {cuenta?.clabe && (
        <ClabeCard clabe={cuenta.clabe} banco={cuenta.banco} titular={cuenta.titular} />
      )}

      <div>
        <h2 className="mb-3 text-lg font-semibold">Historial</h2>
        {payments.length === 0 ? (
          <EmptyState
            icon={Banknote}
            title="Sin movimientos"
            description="Aquí aparecerá el historial de tu renta."
          />
        ) : (
          <div className="space-y-3">
            {payments.map((p) => (
              <Card key={p.id}>
                <CardContent className="flex items-center justify-between gap-3 py-4">
                  <div className="min-w-0">
                    <p className="font-medium">{formatMonth(p.period_month)}</p>
                    <p className="text-muted-foreground flex flex-wrap items-center gap-1.5 text-sm">
                      {formatMXN(p.amount_due)}
                      <Badge variant={STATUS_VARIANT[p.status]}>
                        {PAYMENT_STATUS_LABELS[p.status]}
                      </Badge>
                      {p.paid_date && `pagado ${formatDate(p.paid_date)}`}
                    </p>
                  </div>
                  <div className="flex shrink-0 gap-1">
                    {p.proof_path && <ProofButton path={p.proof_path} getUrl={getProofUrl} />}
                    {p.receipt_pdf_url && <ReceiptButton path={p.receipt_pdf_url} />}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
