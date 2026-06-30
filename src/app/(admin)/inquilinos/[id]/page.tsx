import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, AlertTriangle } from "lucide-react";
import { getLeaseAccount } from "@/app/_lib/data/finance";
import { getProfile } from "@/app/_lib/dal";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatMXN, formatMonth, formatDate } from "@/app/_lib/format";
import {
  PAYMENT_STATUS_LABELS,
  PAYMENT_METHOD_LABELS,
  LEASE_STATUS_LABELS,
  TENANT_DOC_KINDS,
  type PaymentStatus,
  type LeaseStatus,
} from "@/app/_lib/types";
import { listDocuments } from "@/app/_lib/data/documents";
import { ExpedienteDocs } from "@/app/_components/expediente-docs";
import { FiscalForm } from "../_components/fiscal-form";
import { RecordPaymentDialog } from "@/app/(admin)/cobros/_components/record-payment-dialog";
import { ReceiptButton } from "@/app/(admin)/cobros/_components/receipt-button";
import { ProofButton } from "@/app/_components/proof-button";
import { getProofUrl } from "@/app/(admin)/cobros/actions";
import { LeaseStatusControl } from "../_components/lease-status-control";
import { DepositToggle } from "../_components/deposit-toggle";
import { RenovarDialog } from "../_components/renovar-dialog";
import { ActaUpload } from "../_components/acta-upload";
import { LeaseDatesEditor } from "../_components/lease-dates-editor";
import { RenovacionCalc } from "../_components/renovacion-calc";
import { RequerimientoButton } from "../_components/requerimiento-button";
import { AbonoList } from "../_components/abono-list";

export const metadata: Metadata = { title: "Estado de cuenta" };

const STATUS_VARIANT: Record<PaymentStatus, "default" | "secondary" | "outline" | "destructive"> = {
  paid: "default",
  pending: "secondary",
  partial: "outline",
  overdue: "destructive",
};
const LEASE_VARIANT: Record<LeaseStatus, "default" | "secondary" | "outline"> = {
  active: "default",
  pending: "secondary",
  ended: "outline",
};

function Stat({ label, value, tone }: { label: string; value: string; tone?: "danger" }) {
  return (
    <Card>
      <CardContent className="py-4">
        <p className="text-muted-foreground text-xs">{label}</p>
        <p className={`text-xl font-bold ${tone === "danger" ? "text-destructive" : ""}`}>{value}</p>
      </CardContent>
    </Card>
  );
}

export default async function EstadoDeCuentaPage(props: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await props.params;
  const [acc, profile] = await Promise.all([getLeaseAccount(id), getProfile()]);
  if (!acc) notFound();
  const orgId = profile?.org_id ?? "";
  const { lease, payments, saldo, pagadoTotal, diasAtraso, abonosByPayment, saldoFavor } = acc;
  const tenantDocs = lease.tenant_profile_id
    ? await listDocuments("profile", lease.tenant_profile_id)
    : [];
  const tenant = lease.tenant?.full_name ?? lease.tenant?.email ?? "Arrendatario";
  // Método de pago "habitual": el más frecuente en sus pagos (sin columna extra).
  const metodoCounts: Record<string, number> = {};
  for (const p of payments) if (p.method) metodoCounts[p.method] = (metodoCounts[p.method] ?? 0) + 1;
  const metodoPago = Object.entries(metodoCounts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;

  return (
    <div className="mx-auto max-w-3xl">
      <Link
        href="/inquilinos"
        className="text-muted-foreground hover:text-foreground mb-4 inline-flex items-center gap-1 text-sm"
      >
        <ArrowLeft className="size-4" /> Arrendatarios
      </Link>

      <div className="mb-1 flex flex-wrap items-center gap-2">
        <h1 className="text-2xl font-bold tracking-tight">{tenant}</h1>
        <Badge variant={LEASE_VARIANT[lease.status as LeaseStatus]}>
          {LEASE_STATUS_LABELS[lease.status as LeaseStatus]}
        </Badge>
      </div>
      <p className="text-muted-foreground mb-4 text-sm">
        {[lease.unit?.property?.name, lease.unit?.label, `Renta ${formatMXN(lease.rent_amount)}`, `día ${lease.payment_day}`]
          .filter(Boolean)
          .join(" · ")}
      </p>

      <div className="mb-6 flex flex-wrap items-end gap-x-6 gap-y-3">
        {(lease.tenant?.email || lease.tenant?.phone) && (
          <div className="text-sm">
            <p className="text-muted-foreground text-xs">Contacto</p>
            <p>{[lease.tenant?.email, lease.tenant?.phone].filter(Boolean).join(" · ")}</p>
          </div>
        )}
        <div className="text-sm">
          <p className="text-muted-foreground text-xs">Forma de pago</p>
          <p>
            {metodoPago
              ? PAYMENT_METHOD_LABELS[metodoPago as keyof typeof PAYMENT_METHOD_LABELS]
              : "Sin registro"}
            {" · "}
            {lease.tenant?.requiere_factura ? "Con factura" : "Sin factura"}
          </p>
        </div>
        <div className="w-48">
          <p className="text-muted-foreground mb-1 text-xs">Estado del contrato</p>
          <LeaseStatusControl leaseId={id} status={lease.status as LeaseStatus} />
        </div>
        <div>
          <p className="text-muted-foreground mb-1 text-xs">Depósito</p>
          <DepositToggle leaseId={id} paid={lease.deposit_paid} />
        </div>
      </div>

      <div className="mb-6 grid grid-cols-3 gap-3">
        <Stat label="Saldo (debe)" value={formatMXN(saldo)} tone={saldo > 0 ? "danger" : undefined} />
        <Stat label="Pagado (histórico)" value={formatMXN(pagadoTotal)} />
        <Stat label="Días de atraso" value={diasAtraso > 0 ? `${diasAtraso}` : "0"} tone={diasAtraso > 0 ? "danger" : undefined} />
      </div>

      {saldoFavor > 0 && (
        <div className="mb-6 rounded-lg bg-emerald-500/10 p-3 text-sm text-emerald-700">
          Tiene {formatMXN(saldoFavor)} a favor (pagó por encima de lo debido en algún mes).
        </div>
      )}

      {saldo > 0 && diasAtraso > 0 && (
        <div className="text-destructive bg-destructive/10 mb-6 flex flex-wrap items-center gap-3 rounded-lg p-3 text-sm">
          <span className="flex items-center gap-2">
            <AlertTriangle className="size-4 shrink-0" />
            Lleva {diasAtraso} días de atraso.
          </span>
          <RequerimientoButton leaseId={id} />
        </div>
      )}

      <div className="mb-6 rounded-lg border p-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-lg font-semibold">Contrato</h2>
          <RenovarDialog
            leaseId={id}
            currentRent={lease.rent_amount}
            currentEnd={lease.end_date}
            suggestedPct={lease.annual_increase_pct}
          />
        </div>
        <p className="text-muted-foreground mb-3 text-sm">
          Captura las fechas del contrato (definen la vigencia que se ve en
          Propiedades y disparan los recordatorios de renovación).
          {lease.annual_increase_pct != null
            ? ` Incremento configurado: ${lease.annual_increase_pct}%.`
            : ""}
        </p>
        <p className="mb-3 text-sm">
          Renta {formatMXN(lease.rent_amount)} · Cuota {formatMXN(lease.maintenance_fee)}
          {lease.parking_fee > 0 && ` · Estac ${formatMXN(lease.parking_fee)}`}
          {lease.furniture_fee > 0 && ` · Muebles ${formatMXN(lease.furniture_fee)}`}
          <span className="font-medium">
            {" · Total "}
            {formatMXN(lease.rent_amount + lease.maintenance_fee + lease.parking_fee + lease.furniture_fee)}/mes
          </span>
        </p>
        {(lease.garantia_monto || lease.poliza_vigencia || lease.pagare_referencia) && (
          <p className="mb-3 text-sm">
            <span className="text-muted-foreground">Garantía:</span>{" "}
            {[
              lease.garantia_monto ? formatMXN(lease.garantia_monto) : null,
              lease.pagare_referencia ? `pagaré ${lease.pagare_referencia}` : null,
            ]
              .filter(Boolean)
              .join(" · ")}
            {lease.poliza_vigencia &&
              (() => {
                const dias = Math.round(
                  (new Date(lease.poliza_vigencia + "T00:00:00Z").getTime() - Date.now()) / 86_400_000,
                );
                return (
                  <span className={dias <= 30 ? "text-destructive font-medium" : "text-muted-foreground"}>
                    {` · póliza vence ${formatDate(lease.poliza_vigencia)}${dias <= 60 ? ` (en ${dias} días)` : ""}`}
                  </span>
                );
              })()}
          </p>
        )}
        <div className="mb-4">
          <LeaseDatesEditor
            leaseId={id}
            startDate={lease.start_date}
            endDate={lease.end_date}
            maintenanceFee={lease.maintenance_fee}
            parkingFee={lease.parking_fee}
            furnitureFee={lease.furniture_fee}
            garantiaMonto={lease.garantia_monto}
            polizaVigencia={lease.poliza_vigencia}
            pagareReferencia={lease.pagare_referencia}
          />
        </div>
        <ActaUpload
          leaseId={id}
          orgId={orgId}
          hasEntrega={!!lease.acta_entrega_path}
          hasVencimiento={!!lease.acta_vencimiento_path}
        />
        <div className="mt-4 border-t pt-4">
          <h3 className="mb-1 text-sm font-semibold">Calculadora de renovación</h3>
          <p className="text-muted-foreground mb-3 text-sm">
            El aumento se calcula con el INPC de Banxico + el margen que elijas — igual que tu
            calculadora de Excel.
          </p>
          <RenovacionCalc
            leaseId={id}
            renta={lease.rent_amount}
            cuota={lease.maintenance_fee}
            desdeDefault={lease.start_date ? lease.start_date.slice(0, 7) : ""}
            m2={lease.unit?.m2 ?? null}
            marketMin={lease.unit?.rent_market_min ?? null}
            marketAvg={lease.unit?.rent_market_avg ?? null}
            marketMax={lease.unit?.rent_market_max ?? null}
          />
        </div>
      </div>

      {lease.tenant_profile_id && (
        <div className="mb-6 space-y-5 rounded-lg border p-4">
          <div>
            <h2 className="text-lg font-semibold">Expediente del arrendatario</h2>
            <p className="text-muted-foreground text-sm">
              Datos fiscales y documentos, todo en un solo lugar.
            </p>
          </div>
          <div>
            <h3 className="mb-2 text-sm font-semibold">Datos fiscales (facturación)</h3>
            <FiscalForm
              profileId={lease.tenant_profile_id}
              rfc={lease.tenant?.rfc ?? null}
              razonSocial={lease.tenant?.razon_social ?? null}
              regimenFiscal={lease.tenant?.regimen_fiscal ?? null}
              usoCfdi={lease.tenant?.uso_cfdi ?? null}
              requiereFactura={lease.tenant?.requiere_factura ?? false}
            />
          </div>
          <div>
            <h3 className="mb-2 text-sm font-semibold">Documentos</h3>
            <ExpedienteDocs
              orgId={orgId}
              ownerType="profile"
              ownerId={lease.tenant_profile_id}
              docs={tenantDocs}
              kindOptions={[...TENANT_DOC_KINDS, "referencias", "otro"]}
              expectedKinds={[...TENANT_DOC_KINDS]}
            />
          </div>
        </div>
      )}

      <h2 className="mb-3 text-lg font-semibold">Movimientos</h2>
      {payments.length === 0 ? (
        <p className="text-muted-foreground text-sm">Sin movimientos todavía.</p>
      ) : (
        <div className="space-y-3">
          {payments.map((p) => (
            <Card key={p.id}>
              <CardContent className="flex flex-wrap items-center justify-between gap-3 py-4">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium">{formatMonth(p.period_month)}</span>
                    <Badge variant={STATUS_VARIANT[p.status]}>{PAYMENT_STATUS_LABELS[p.status]}</Badge>
                  </div>
                  <p className="text-muted-foreground text-sm">
                    {[
                      formatMXN(p.amount_due),
                      p.due_date && `vence ${formatDate(p.due_date)}`,
                      p.paid_date && `pagado ${formatDate(p.paid_date)}`,
                      p.method && PAYMENT_METHOD_LABELS[p.method],
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                  <AbonoList abonos={abonosByPayment[p.id] ?? []} />
                  {p.tenant_marked_paid_at && p.status !== "paid" && (
                    <p className="text-muted-foreground text-xs">
                      El arrendatario marcó como pagado{p.tenant_reference ? ` (clave ${p.tenant_reference})` : ""}.
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
          ))}
        </div>
      )}
    </div>
  );
}
