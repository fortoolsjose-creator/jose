import type { Metadata } from "next";
import { FileText, CalendarClock } from "lucide-react";
import { getTenantLease, getTenantRenewals } from "@/app/_lib/data/tenant";
import { PageHeader } from "@/app/_components/page-header";
import { EmptyState } from "@/app/_components/empty-state";
import { Card, CardContent } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
import { ProofButton } from "@/app/_components/proof-button";
import { formatMXN, formatDate } from "@/app/_lib/format";
import { GUARANTEE_TYPE_LABELS, LEASE_STATUS_LABELS } from "@/app/_lib/types";
import { getActaUrl } from "./actions";

export const metadata: Metadata = { title: "Mi contrato" };

const DAY = 86_400_000;

export default async function MiContratoPage() {
  const [lease, renewals] = await Promise.all([
    getTenantLease(),
    getTenantRenewals(),
  ]);

  if (!lease) {
    return (
      <>
        <PageHeader title="Mi contrato" subtitle="Los datos de tu contrato." />
        <EmptyState
          icon={FileText}
          title="Sin contrato todavía"
          description="Cuando tu arrendador active tu contrato, aquí verás sus datos."
        />
      </>
    );
  }

  const p = lease.unit?.property;
  const address = [
    p?.street,
    p?.ext_number && `#${p.ext_number}`,
    p?.int_number && `int. ${p.int_number}`,
    p?.colonia,
    p?.municipio,
    p?.cp,
  ]
    .filter(Boolean)
    .join(", ");

  const todayMs = Date.parse(new Date().toISOString().slice(0, 10) + "T00:00:00Z");
  const endMs = lease.end_date ? Date.parse(lease.end_date + "T00:00:00Z") : null;
  const daysToEnd = endMs != null ? Math.round((endMs - todayMs) / DAY) : null;
  const renewSoon = daysToEnd != null && daysToEnd >= 0 && daysToEnd <= 90;

  const pct = lease.annual_increase_pct;
  const nextRent =
    pct != null ? Number(lease.rent_amount) * (1 + Number(pct) / 100) : null;

  const rows: [string, string][] = [
    ["Propiedad", p?.name ?? "—"],
    ["Unidad", lease.unit?.label ?? "—"],
    ["Dirección", address || "—"],
    ["Renta", formatMXN(lease.rent_amount)],
    ["Depósito", formatMXN(lease.deposit_amount)],
    ["Día de pago", `día ${lease.payment_day} de cada mes`],
    ["Inicio", formatDate(lease.start_date)],
    ["Vigencia (fin)", lease.end_date ? formatDate(lease.end_date) : "—"],
    [
      "Garantía",
      lease.guarantee_type ? GUARANTEE_TYPE_LABELS[lease.guarantee_type] : "—",
    ],
    ["Estado", LEASE_STATUS_LABELS[lease.status]],
  ];

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <PageHeader title="Mi contrato" subtitle="Los datos de tu contrato." />

      {daysToEnd != null && (
        <Card className={renewSoon ? "border-primary" : undefined}>
          <CardContent className="flex items-start gap-3 py-4">
            <CalendarClock
              className={`mt-0.5 size-5 shrink-0 ${renewSoon ? "text-primary" : "text-muted-foreground"}`}
            />
            <div className="text-sm">
              {daysToEnd < 0 ? (
                <p>
                  Tu contrato <span className="font-semibold">venció</span> el{" "}
                  {formatDate(lease.end_date)}. Contacta a tu arrendador para renovarlo.
                </p>
              ) : renewSoon ? (
                <p>
                  <span className="font-semibold">Te toca renovar pronto.</span> Tu
                  contrato vence el {formatDate(lease.end_date)} (en {daysToEnd}{" "}
                  {daysToEnd === 1 ? "día" : "días"}).
                </p>
              ) : (
                <p>
                  Tu contrato vence el {formatDate(lease.end_date)} (en {daysToEnd} días).
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="py-0">
          <dl className="divide-y">
            {rows.map(([k, v]) => (
              <div key={k} className="flex justify-between gap-4 py-3 text-sm">
                <dt className="text-muted-foreground">{k}</dt>
                <dd className="text-right font-medium">{v}</dd>
              </div>
            ))}
          </dl>
        </CardContent>
      </Card>

      {nextRent != null && (
        <Card>
          <CardContent className="py-4">
            <p className="text-muted-foreground text-sm">
              Renta estimada al renovar (+{pct}%)
            </p>
            <p className="text-2xl font-bold">{formatMXN(nextRent)}</p>
            <p className="text-muted-foreground text-xs">
              Hoy pagas {formatMXN(lease.rent_amount)}. El monto final lo confirma tu
              arrendador.
            </p>
          </CardContent>
        </Card>
      )}

      {(lease.contract_doc_url ||
        lease.acta_entrega_path ||
        lease.acta_vencimiento_path) && (
        <div className="flex flex-wrap gap-2">
          {lease.contract_doc_url && (
            <a
              href={lease.contract_doc_url}
              target="_blank"
              rel="noopener noreferrer"
              className={buttonVariants({ variant: "outline" })}
            >
              <FileText className="size-4" /> Documento del contrato
            </a>
          )}
          {lease.acta_entrega_path && (
            <ProofButton path="entrega" getUrl={getActaUrl} label="Acta de entrega" />
          )}
          {lease.acta_vencimiento_path && (
            <ProofButton
              path="vencimiento"
              getUrl={getActaUrl}
              label="Acta de vencimiento"
            />
          )}
        </div>
      )}

      {renewals.length > 0 && (
        <div>
          <h2 className="mb-2 text-lg font-semibold">Historial de renovaciones</h2>
          <div className="space-y-2">
            {renewals.map((r) => (
              <Card key={r.id}>
                <CardContent className="flex flex-wrap justify-between gap-3 py-3 text-sm">
                  <span className="text-muted-foreground">
                    {formatDate(r.created_at)}
                    {r.new_end ? ` · vigencia hasta ${formatDate(r.new_end)}` : ""}
                  </span>
                  <span className="font-medium">
                    {formatMXN(r.previous_rent)} → {formatMXN(r.new_rent)}
                    {r.increase_pct != null ? ` (+${r.increase_pct}%)` : ""}
                  </span>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
