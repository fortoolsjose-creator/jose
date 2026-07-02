import "server-only";
import { createClient } from "@/app/_lib/supabase/server";
import type { Payment } from "@/app/_lib/types";

const DAY = 86_400_000;

/** Hoy en America/Mexico_City como YYYY-MM-DD (evita el desfase por el reloj UTC del servidor). */
function todayMX(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Mexico_City" }).format(new Date());
}
export function currentPeriod(): string {
  return `${todayMX().slice(0, 7)}-01`;
}
export function daysOverdue(due: string | null): number {
  if (!due) return 0;
  const diff = Math.floor(
    (Date.parse(todayMX() + "T00:00:00Z") - Date.parse(due + "T00:00:00Z")) / DAY,
  );
  return diff > 0 ? diff : 0;
}
export function isOverdue(p: { amount_due: number; amount_paid: number; status: string; due_date: string | null; period_month?: string | null }): boolean {
  const bal = Number(p.amount_due) - Number(p.amount_paid);
  if (bal <= 0) return false;
  // La renta del mes en curso (o de meses futuros) todavía NO se considera
  // vencida: se muestra como "por cobrar" hasta que el mes termine.
  if (p.period_month && p.period_month.slice(0, 7) >= currentPeriod().slice(0, 7)) return false;
  return p.status === "overdue" || (!!p.due_date && p.status !== "paid" && daysOverdue(p.due_date) > 0);
}

export type CollectionSummary = {
  period: string;
  cobrado: number;
  porCobrar: number;
  totalMes: number;
  pctCobranza: number;
  vencidoTotal: number;
  deudores: number;
};

export async function getCollectionSummary(): Promise<CollectionSummary> {
  const supabase = await createClient();
  const period = currentPeriod();
  const { data } = await supabase
    .from("payments")
    .select("lease_id, amount_due, amount_paid, status, period_month, due_date")
    .is("deleted_at", null);
  const rows = data ?? [];
  const tm = rows.filter((r) => r.period_month === period);
  const cobrado = tm.reduce((s, r) => s + Number(r.amount_paid), 0);
  const totalMes = tm.reduce((s, r) => s + Number(r.amount_due), 0);
  const porCobrar = tm.reduce((s, r) => s + Math.max(0, Number(r.amount_due) - Number(r.amount_paid)), 0);
  const overdue = rows.filter(isOverdue);
  const vencidoTotal = overdue.reduce((s, r) => s + (Number(r.amount_due) - Number(r.amount_paid)), 0);
  return {
    period,
    cobrado,
    porCobrar,
    totalMes,
    pctCobranza: totalMes > 0 ? cobrado / totalMes : 0,
    vencidoTotal,
    deudores: new Set(overdue.map((r) => r.lease_id)).size,
  };
}

export type Debtor = {
  lease_id: string;
  tenant: string;
  unit: string;
  saldoVencido: number;
  diasAtraso: number;
  moraCalculada: number;
};

/**
 * Interés moratorio simple, prorrateado por día: saldo × (tasa%/mes) × (días cobrables / 30),
 * donde días cobrables = días de atraso − días de gracia. 0 si no hay tasa o sigue en gracia.
 */
export function calcMora(
  saldoVencido: number,
  diasAtraso: number,
  tasaMensual: number,
  diasGracia: number,
): number {
  if (tasaMensual <= 0 || saldoVencido <= 0) return 0;
  const cobrables = diasAtraso - diasGracia;
  if (cobrables <= 0) return 0;
  return Math.round(saldoVencido * (tasaMensual / 100) * (cobrables / 30));
}

/** Campos extra del contrato (cuota-desde, renovación) — tolerante a columnas inexistentes. */
export async function getLeaseExtras(leaseId: string): Promise<{
  maintenanceFeeDesde: string | null;
  renewalDeadline: string | null;
  renewalSentAt: string | null;
  renewalRespondedAt: string | null;
}> {
  const supabase = await createClient();
  const { data } = await supabase.from("leases").select("*").eq("id", leaseId).maybeSingle();
  const o = data as Record<string, unknown> | null;
  return {
    maintenanceFeeDesde: (o?.["maintenance_fee_desde"] as string) ?? null,
    renewalDeadline: (o?.["renewal_deadline"] as string) ?? null,
    renewalSentAt: (o?.["renewal_sent_at"] as string) ?? null,
    renewalRespondedAt: (o?.["renewal_responded_at"] as string) ?? null,
  };
}

/** Config de moratorios de la org (tolerante a que aún no existan las columnas). */
export async function getMoraConfig(): Promise<{ tasa: number; gracia: number }> {
  const supabase = await createClient();
  const { data } = await supabase.from("organizations").select("*").limit(1).maybeSingle();
  const o = data as Record<string, unknown> | null;
  return {
    tasa: Number(o?.["mora_tasa_mensual"] ?? 0),
    gracia: Number(o?.["mora_dias_gracia"] ?? 0),
  };
}

export async function listDebtors(): Promise<Debtor[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("payments")
    .select(
      "lease_id, amount_due, amount_paid, status, due_date, period_month, lease:leases(unit:units(label, property:properties(name)), tenant:profiles(full_name, email))",
    )
    .is("deleted_at", null);

  // La tasa se aplica a CADA recibo con sus propios días de atraso, no al saldo agregado.
  const { tasa, gracia } = await getMoraConfig();

  const byLease = new Map<
    string,
    { saldo: number; oldest: string | null; mora: number; tenant: string; unit: string }
  >();
  for (const r of data ?? []) {
    if (!isOverdue(r)) continue;
    const lease = (r as unknown as {
      lease?: { unit?: { label: string; property?: { name: string } | null }; tenant?: { full_name: string | null; email: string | null } };
    }).lease;
    const e =
      byLease.get(r.lease_id) ?? {
        saldo: 0,
        oldest: null,
        mora: 0,
        tenant: lease?.tenant?.full_name ?? lease?.tenant?.email ?? "Arrendatario",
        unit: [lease?.unit?.property?.name, lease?.unit?.label].filter(Boolean).join(" · "),
      };
    const bal = Number(r.amount_due) - Number(r.amount_paid);
    e.saldo += bal;
    e.mora += calcMora(bal, daysOverdue(r.due_date), tasa, gracia);
    if (r.due_date && (!e.oldest || r.due_date < e.oldest)) e.oldest = r.due_date;
    byLease.set(r.lease_id, e);
  }

  return [...byLease.entries()]
    .map(([lease_id, e]) => ({
      lease_id,
      tenant: e.tenant,
      unit: e.unit,
      saldoVencido: e.saldo,
      diasAtraso: daysOverdue(e.oldest),
      moraCalculada: Math.round(e.mora),
    }))
    .sort((a, b) => b.saldoVencido - a.saldoVencido);
}

export type LeaseAccount = {
  lease: {
    id: string;
    tenant_profile_id: string | null;
    rent_amount: number;
    deposit_amount: number;
    deposit_paid: boolean;
    maintenance_fee: number;
    parking_fee: number;
    furniture_fee: number;
    garantia_monto: number | null;
    poliza_vigencia: string | null;
    pagare_referencia: string | null;
    payment_day: number;
    status: string;
    start_date: string | null;
    end_date: string | null;
    annual_increase_pct: number | null;
    acta_entrega_path: string | null;
    acta_vencimiento_path: string | null;
    unit: { label: string; m2: number | null; rent_market_min: number | null; rent_market_avg: number | null; rent_market_max: number | null; property: { name: string } | null } | null;
    tenant: {
      full_name: string | null;
      email: string | null;
      phone: string | null;
      rfc: string | null;
      razon_social: string | null;
      regimen_fiscal: string | null;
      uso_cfdi: string | null;
      requiere_factura: boolean;
    } | null;
  };
  payments: Payment[];
  saldo: number;
  pagadoTotal: number;
  diasAtraso: number;
  abonosByPayment: Record<string, Abono[]>;
  saldoFavor: number;
};

export type Abono = {
  id: string;
  monto: number;
  fecha: string | null;
  method: string | null;
  reference: string | null;
};

export async function getLeaseAccount(leaseId: string): Promise<LeaseAccount | null> {
  const supabase = await createClient();
  const { data: lease } = await supabase
    .from("leases")
    .select(
      "id, tenant_profile_id, rent_amount, deposit_amount, deposit_paid, maintenance_fee, parking_fee, furniture_fee, garantia_monto, poliza_vigencia, pagare_referencia, payment_day, status, start_date, end_date, annual_increase_pct, acta_entrega_path, acta_vencimiento_path, unit:units(label, m2, rent_market_min, rent_market_avg, rent_market_max, property:properties(name)), tenant:profiles(full_name, email, phone, rfc, razon_social, regimen_fiscal, uso_cfdi, requiere_factura)",
    )
    .eq("id", leaseId)
    .is("deleted_at", null)
    .maybeSingle();
  if (!lease) return null;

  const { data: pays } = await supabase
    .from("payments")
    .select("*")
    .eq("lease_id", leaseId)
    .is("deleted_at", null)
    .order("period_month", { ascending: false });
  const payments = (pays ?? []) as Payment[];

  const payIds = payments.map((p) => p.id);
  const { data: allocData } = payIds.length
    ? await supabase
        .from("payment_allocations")
        .select("id, payment_id, monto, fecha, method, reference")
        .in("payment_id", payIds)
        .order("created_at", { ascending: true })
    : { data: [] as unknown[] };
  const abonosByPayment: Record<string, Abono[]> = {};
  for (const a of (allocData ?? []) as {
    id: string;
    payment_id: string;
    monto: number;
    fecha: string | null;
    method: string | null;
    reference: string | null;
  }[]) {
    (abonosByPayment[a.payment_id] ??= []).push({
      id: a.id,
      monto: Number(a.monto),
      fecha: a.fecha,
      method: a.method,
      reference: a.reference,
    });
  }
  const saldoFavor = payments.reduce(
    (s, p) => s + Math.max(0, Number(p.amount_paid) - Number(p.amount_due)),
    0,
  );

  const saldo = payments.reduce((s, p) => s + Math.max(0, Number(p.amount_due) - Number(p.amount_paid)), 0);
  const pagadoTotal = payments.reduce((s, p) => s + Number(p.amount_paid), 0);
  const overdue = payments.filter(isOverdue);
  const oldest = overdue.reduce<string | null>((o, p) => (p.due_date && (!o || p.due_date < o) ? p.due_date : o), null);

  return {
    lease: lease as unknown as LeaseAccount["lease"],
    payments,
    saldo,
    pagadoTotal,
    diasAtraso: daysOverdue(oldest),
    abonosByPayment,
    saldoFavor,
  };
}
