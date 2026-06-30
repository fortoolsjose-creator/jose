import "server-only";
import { createClient } from "@/app/_lib/supabase/server";
import { currentPeriod } from "@/app/_lib/data/finance";
import type { ExpenseCategory } from "@/app/_lib/types";

export type Punctuality = {
  total: number; // pagos ya concluidos (con fecha de pago)
  aTiempo: number;
  pct: number;
  morosos: { tenant: string; tarde: number; total: number }[];
};

export type Facturacion = {
  con: { n: number; monto: number };
  sin: { n: number; monto: number };
  pendiente: { n: number; monto: number };
};

/** Reporte de pagos: puntualidad (a tiempo vs tarde) y facturación (con/sin/pendiente). */
export async function getPaymentReport(period?: string): Promise<{
  puntualidad: Punctuality;
  facturacion: Facturacion;
}> {
  const supabase = await createClient();
  let q = supabase
    .from("payments")
    .select(
      "amount_paid, amount_due, due_date, paid_date, status, fiscal_status, period_month, lease:leases(tenant:profiles(full_name, email))",
    )
    .is("deleted_at", null);
  if (period) q = q.eq("period_month", period);
  const { data } = await q;
  const rows = data ?? [];

  // Puntualidad: sobre pagos concluidos (con paid_date).
  const concluidos = rows.filter((r) => r.paid_date);
  const aTiempo = concluidos.filter(
    (r) => r.due_date && (r.paid_date as string) <= r.due_date,
  ).length;
  const byTenant = new Map<string, { tarde: number; total: number }>();
  for (const r of concluidos) {
    const t = (r as unknown as { lease?: { tenant?: { full_name: string | null; email: string | null } } })
      .lease?.tenant;
    const name = t?.full_name ?? t?.email ?? "Arrendatario";
    const e = byTenant.get(name) ?? { tarde: 0, total: 0 };
    e.total += 1;
    const late = !r.due_date || (r.paid_date as string) > r.due_date;
    if (late) e.tarde += 1;
    byTenant.set(name, e);
  }
  const morosos = [...byTenant.entries()]
    .map(([tenant, v]) => ({ tenant, tarde: v.tarde, total: v.total }))
    .filter((m) => m.tarde > 0)
    .sort((a, b) => b.tarde - a.tarde)
    .slice(0, 10);

  // Facturación: sobre pagos con dinero recibido.
  const pagados = rows.filter((r) => Number(r.amount_paid) > 0);
  const fac: Facturacion = {
    con: { n: 0, monto: 0 },
    sin: { n: 0, monto: 0 },
    pendiente: { n: 0, monto: 0 },
  };
  for (const r of pagados) {
    const key = r.fiscal_status === "con_factura" ? "con" : r.fiscal_status === "sin_factura" ? "sin" : "pendiente";
    fac[key].n += 1;
    fac[key].monto += Number(r.amount_paid);
  }

  return {
    puntualidad: {
      total: concluidos.length,
      aTiempo,
      pct: concluidos.length > 0 ? aTiempo / concluidos.length : 0,
      morosos,
    },
    facturacion: fac,
  };
}

/**
 * Fiscal REAL (no estimado): suma IVA y retención SOLO de los pagos que de verdad
 * se facturaron (fiscal_status = con_factura). Los pagos en efectivo / sin factura
 * no cuentan. Filtra por período si se pasa.
 */
export async function getFiscalReport(
  period?: string,
): Promise<{ facturado: number; iva: number; retencion: number; n: number }> {
  const supabase = await createClient();
  let q = supabase
    .from("payments")
    .select("subtotal, iva, retencion_isr, period_month")
    .is("deleted_at", null)
    .eq("fiscal_status", "con_factura");
  if (period) q = q.eq("period_month", period);
  const { data } = await q;
  let facturado = 0;
  let iva = 0;
  let retencion = 0;
  for (const r of data ?? []) {
    facturado += Number(r.subtotal ?? 0);
    iva += Number(r.iva ?? 0);
    retencion += Number(r.retencion_isr ?? 0);
  }
  return { facturado, iva, retencion, n: (data ?? []).length };
}

export type ExpenseByCategory = {
  category: ExpenseCategory;
  total: number;
  conFactura: number;
};

/** Gastos del periodo agrupados por categoría + cuánto tiene factura. */
export async function getExpenseReport(period?: string): Promise<{
  period: string;
  rows: ExpenseByCategory[];
  total: number;
  totalConFactura: number;
}> {
  const supabase = await createClient();
  const p = period ?? currentPeriod();
  const { data } = await supabase
    .from("expenses")
    .select("category, amount, has_invoice")
    .eq("period_month", p)
    .is("deleted_at", null);

  const map = new Map<ExpenseCategory, ExpenseByCategory>();
  let total = 0;
  let totalConFactura = 0;
  for (const e of data ?? []) {
    const cat = e.category as ExpenseCategory;
    const row = map.get(cat) ?? { category: cat, total: 0, conFactura: 0 };
    const amt = Number(e.amount);
    row.total += amt;
    if (e.has_invoice) row.conFactura += amt;
    map.set(cat, row);
    total += amt;
    if (e.has_invoice) totalConFactura += amt;
  }
  return {
    period: p,
    rows: [...map.values()].sort((a, b) => b.total - a.total),
    total,
    totalConFactura,
  };
}

// --- 1) Tendencia mes a mes (facturado vs cobrado) ---
export type MonthTrend = { period: string; facturado: number; cobrado: number };

export async function getMonthlyTrend(n = 6): Promise<MonthTrend[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("payments")
    .select("period_month, amount_due, amount_paid")
    .is("deleted_at", null);
  const map = new Map<string, { facturado: number; cobrado: number }>();
  for (const r of data ?? []) {
    const m = r.period_month as string;
    const e = map.get(m) ?? { facturado: 0, cobrado: 0 };
    e.facturado += Number(r.amount_due);
    e.cobrado += Number(r.amount_paid);
    map.set(m, e);
  }
  return [...map.entries()]
    .sort((a, b) => (a[0] < b[0] ? -1 : 1))
    .slice(-n)
    .map(([period, v]) => ({ period, ...v }));
}

// --- 2) Tasa de cobranza + antigüedad de cartera (aging) ---
export type Aging = {
  rate: number; // cobrado / facturado (histórico)
  totalDue: number;
  totalPaid: number;
  buckets: { label: string; monto: number }[];
};

export async function getCollectionAging(): Promise<Aging> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("payments")
    .select("amount_due, amount_paid, due_date")
    .is("deleted_at", null);
  const rows = data ?? [];
  const totalDue = rows.reduce((s, r) => s + Number(r.amount_due), 0);
  const totalPaid = rows.reduce((s, r) => s + Number(r.amount_paid), 0);
  const today = Date.parse(new Date().toISOString().slice(0, 10) + "T00:00:00Z");
  const b = { corriente: 0, d30: 0, d60: 0, d90: 0, mas90: 0 };
  for (const r of rows) {
    const bal = Number(r.amount_due) - Number(r.amount_paid);
    if (bal <= 0) continue;
    const due = r.due_date ? Date.parse((r.due_date as string) + "T00:00:00Z") : null;
    const days = due != null ? Math.floor((today - due) / 86_400_000) : 0;
    if (days <= 0) b.corriente += bal;
    else if (days <= 30) b.d30 += bal;
    else if (days <= 60) b.d60 += bal;
    else if (days <= 90) b.d90 += bal;
    else b.mas90 += bal;
  }
  return {
    rate: totalDue > 0 ? totalPaid / totalDue : 0,
    totalDue,
    totalPaid,
    buckets: [
      { label: "Por vencer", monto: b.corriente },
      { label: "1–30 días", monto: b.d30 },
      { label: "31–60 días", monto: b.d60 },
      { label: "61–90 días", monto: b.d90 },
      { label: "+90 días", monto: b.mas90 },
    ],
  };
}

// --- Concentración (riesgo): qué arrendatario pesa más en el ingreso ---
export type Concentration = {
  topTenant: { name: string; monto: number; pct: number } | null;
  totalIngreso: number;
};

export async function getConcentration(): Promise<Concentration> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("leases")
    .select("rent_amount, tenant:profiles(full_name, email)")
    .eq("status", "active")
    .is("deleted_at", null);
  const map = new Map<string, number>();
  let total = 0;
  for (const l of data ?? []) {
    const t = (l as unknown as { tenant?: { full_name: string | null; email: string | null } }).tenant;
    const name = t?.full_name ?? t?.email ?? "Arrendatario";
    const r = Number(l.rent_amount);
    map.set(name, (map.get(name) ?? 0) + r);
    total += r;
  }
  let topTenant: Concentration["topTenant"] = null;
  for (const [name, monto] of map) {
    if (!topTenant || monto > topTenant.monto) {
      topTenant = { name, monto, pct: total > 0 ? monto / total : 0 };
    }
  }
  return { topTenant, totalIngreso: total };
}

// --- Precio de mercado: renta actual vs mín/prom/máx del estudio MPM ---
// "Comparable" = unidad ocupada (contrato activo) con renta creíble. Las vacías y
// las que traen renta placeholder (menos de la mitad del mínimo de mercado) NO se
// comparan: meterlas inflaría el "sin captar" con cifras irreales.
const CREDIBLE_RENT_FLOOR = 0.5; // fracción del mínimo de mercado

export type MarketRow = {
  unitId: string;
  unit: string;
  current: number; // renta del contrato activo
  min: number;
  avg: number;
  max: number;
  gap: number; // current - avg (negativo = por debajo del mercado)
  pct: number; // current / avg - 1
  status: "abajo" | "rango" | "arriba";
};

export type MarketReport = {
  rows: MarketRow[]; // solo comparables, ordenadas (más por debajo primero)
  comparables: number;
  vacantes: number; // con precio de mercado pero sin contrato activo
  sinRenta: number; // ocupadas con renta no creíble (por capturar)
  upliftPotential: number; // Σ max(0, prom - actual) sobre comparables
  belowCount: number; // comparables por debajo del mínimo de mercado
  withData: number; // total de unidades con precio de mercado
};

export async function getMarketPriceReport(): Promise<MarketReport> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("units")
    .select(
      "id, label, rent_amount, status, rent_market_min, rent_market_avg, rent_market_max, property:properties(name), leases(rent_amount, status)",
    )
    .is("deleted_at", null)
    .not("rent_market_avg", "is", null);

  const rows: MarketRow[] = [];
  let comparables = 0;
  let vacantes = 0;
  let sinRenta = 0;
  let upliftPotential = 0;
  let belowCount = 0;
  let withData = 0;

  for (const u of data ?? []) {
    const unit = u as unknown as {
      id: string;
      label: string;
      rent_market_min: number | null;
      rent_market_avg: number | null;
      rent_market_max: number | null;
      property?: { name: string } | null;
      leases?: { rent_amount: number; status: string }[] | null;
    };
    const avg = Number(unit.rent_market_avg);
    if (!avg) continue;
    withData += 1;
    const min = Number(unit.rent_market_min ?? 0);
    const max = Number(unit.rent_market_max ?? 0);
    const active = (unit.leases ?? []).find((l) => l.status === "active");
    const current = Number(active?.rent_amount ?? 0) || 0;

    if (!active) {
      vacantes += 1;
      continue;
    }
    if (current < CREDIBLE_RENT_FLOOR * (min || avg)) {
      sinRenta += 1; // ocupada pero renta placeholder: no se compara
      continue;
    }

    comparables += 1;
    const status: MarketRow["status"] =
      min && current < min ? "abajo" : max && current > max ? "arriba" : "rango";
    if (status === "abajo") belowCount += 1;
    if (current < avg) upliftPotential += avg - current;

    rows.push({
      unitId: unit.id,
      unit: [unit.property?.name, unit.label].filter(Boolean).join(" · "),
      current,
      min,
      avg,
      max,
      gap: current - avg,
      pct: avg > 0 ? current / avg - 1 : 0,
      status,
    });
  }

  rows.sort((a, b) => a.gap - b.gap); // más por debajo del mercado primero
  return { rows, comparables, vacantes, sinRenta, upliftPotential, belowCount, withData };
}

// --- Cobrado por forma de pago (efectivo vs transferencia) del mes ---
export type CashSplit = { efectivo: number; transferencia: number; otro: number; total: number };

export async function getCashVsTransfer(period?: string): Promise<CashSplit> {
  const supabase = await createClient();
  const prefix = (period ?? currentPeriod()).slice(0, 7); // YYYY-MM
  const [{ data: pays }, { data: fees }] = await Promise.all([
    supabase.from("payments").select("amount_paid, method, paid_date").is("deleted_at", null).gt("amount_paid", 0),
    supabase.from("maintenance_fees").select("amount_paid, method, paid_date").is("deleted_at", null).gt("amount_paid", 0),
  ]);
  const out: CashSplit = { efectivo: 0, transferencia: 0, otro: 0, total: 0 };
  const add = (rows: { amount_paid: number; method: string | null; paid_date: string | null }[] | null) => {
    for (const r of rows ?? []) {
      if (!r.paid_date || !String(r.paid_date).startsWith(prefix)) continue;
      const amt = Number(r.amount_paid) || 0;
      if (r.method === "cash") out.efectivo += amt;
      else if (r.method === "spei") out.transferencia += amt;
      else out.otro += amt;
      out.total += amt;
    }
  };
  add(pays as never);
  add(fees as never);
  return out;
}

// --- 3) Vencimientos próximos (pipeline de renovaciones) ---
export type Expiration = {
  lease_id: string;
  tenant: string;
  unit: string;
  end_date: string;
  dias: number;
  rent: number;
};

export async function getUpcomingExpirations(days = 90): Promise<Expiration[]> {
  const supabase = await createClient();
  const todayStr = new Date().toISOString().slice(0, 10);
  const today = Date.parse(todayStr + "T00:00:00Z");
  const limit = new Date(today + days * 86_400_000).toISOString().slice(0, 10);

  const { data } = await supabase
    .from("leases")
    .select(
      "id, end_date, rent_amount, unit:units(label, property:properties(name)), tenant:profiles(full_name, email)",
    )
    .eq("status", "active")
    .is("deleted_at", null)
    .not("end_date", "is", null)
    .gte("end_date", todayStr)
    .lte("end_date", limit)
    .order("end_date", { ascending: true });

  return (data ?? []).map((l) => {
    const lease = l as unknown as {
      unit?: { label: string; property?: { name: string } | null } | null;
      tenant?: { full_name: string | null; email: string | null } | null;
    };
    return {
      lease_id: l.id as string,
      tenant: lease.tenant?.full_name ?? lease.tenant?.email ?? "Arrendatario",
      unit: [lease.unit?.property?.name, lease.unit?.label].filter(Boolean).join(" · "),
      end_date: l.end_date as string,
      dias: Math.round((Date.parse((l.end_date as string) + "T00:00:00Z") - today) / 86_400_000),
      rent: Number(l.rent_amount),
    };
  });
}

// --- Pronóstico de flujo: ingreso esperado de los próximos N meses ---
const pad2 = (n: number) => String(n).padStart(2, "0");
export type ForecastMonth = { period: string; esperado: number; enRiesgo: number };

/**
 * Proyecta el ingreso (renta + cuota) de contratos activos para los próximos N
 * meses. Un contrato que ya venció (end_date anterior al mes) y no se ha renovado
 * cuenta como "en riesgo" en vez de esperado.
 */
export async function getCashForecast(months = 6): Promise<ForecastMonth[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("leases")
    .select("rent_amount, maintenance_fee, end_date")
    .eq("status", "active")
    .is("deleted_at", null);
  const base = (data ?? []).map((l) => ({
    amt: Number(l.rent_amount) + Number(l.maintenance_fee ?? 0),
    end: (l.end_date as string | null) ?? null,
  }));

  const now = new Date();
  const out: ForecastMonth[] = [];
  for (let i = 0; i < months; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
    const period = `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-01`;
    const monthEnd = new Date(d.getFullYear(), d.getMonth() + 1, 0).toISOString().slice(0, 10);
    let esperado = 0;
    let enRiesgo = 0;
    for (const l of base) {
      if (!l.end || l.end >= monthEnd) esperado += l.amt;
      else enRiesgo += l.amt;
    }
    out.push({ period, esperado, enRiesgo });
  }
  return out;
}

// --- Top arrendatarios por ingreso (concentración) ---
export type TenantShare = { name: string; monto: number; pct: number };

export async function getTopTenants(n = 5): Promise<{ tenants: TenantShare[]; total: number }> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("leases")
    .select("rent_amount, maintenance_fee, tenant:profiles(full_name, email)")
    .eq("status", "active")
    .is("deleted_at", null);
  const map = new Map<string, number>();
  let total = 0;
  for (const l of data ?? []) {
    const t = (l as unknown as { tenant?: { full_name: string | null; email: string | null } }).tenant;
    const name = t?.full_name ?? t?.email ?? "Arrendatario";
    const amt = Number(l.rent_amount) + Number(l.maintenance_fee ?? 0);
    map.set(name, (map.get(name) ?? 0) + amt);
    total += amt;
  }
  const tenants = [...map.entries()]
    .map(([name, monto]) => ({ name, monto, pct: total > 0 ? monto / total : 0 }))
    .sort((a, b) => b.monto - a.monto)
    .slice(0, n);
  return { tenants, total };
}

// --- Satisfacción (NPS simple) de los arrendatarios tras resolver reportes ---
export async function getSatisfactionSummary(): Promise<{ avg: number; count: number }> {
  const supabase = await createClient();
  const { data } = await supabase.from("satisfaction_ratings").select("rating");
  const rows = data ?? [];
  const count = rows.length;
  const avg = count > 0 ? rows.reduce((s, r) => s + Number(r.rating), 0) / count : 0;
  return { avg, count };
}
