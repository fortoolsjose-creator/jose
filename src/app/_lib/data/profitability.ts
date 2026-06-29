import "server-only";
import { createClient } from "@/app/_lib/supabase/server";
import { currentPeriod } from "@/app/_lib/data/finance";

export const IVA_RATE = 0.16; // IVA en arrendamiento comercial
export const RET_RATE = 0.1; // retención de ISR por arrendatarios persona moral

export type BuildingProfit = {
  property_id: string;
  name: string;
  colonia: string | null;
  municipio: string | null;
  ciudad: string | null;
  market_value: number | null;
  m2: number;
  rentPerM2: number | null;
  units: number;
  occupied: number;
  occupancy: number;
  rentaPotencial: number;
  ocupacionIngresos: number;
  ingresoEsperado: number;
  ingresoComercial: number;
  ingresoResidencial: number;
  gastos: number;
  noi: number;
  capRate: number | null;
  ivaEstimado: number;
  retencionEstimada: number;
};

export type ProfitTotals = {
  ingresoEsperado: number;
  gastos: number;
  gastosGenerales: number;
  noi: number;
  ivaEstimado: number;
  retencionEstimada: number;
  units: number;
  occupied: number;
  occupancy: number;
  rentaPotencial: number;
  ocupacionIngresos: number;
};

export type Patrimonio = {
  valor: number; // suma de market_value de las propiedades valuadas
  valuedCount: number;
  total: number;
  plusvalia: number | null; // (valor actual − valor de compra) / valor de compra
  ganancia: number;
};

/** Patrimonio: valor de las propiedades valuadas + plusvalía vs su primer valor. */
export async function getPatrimonio(): Promise<Patrimonio> {
  const supabase = await createClient();
  const [{ data: props }, { data: vals }] = await Promise.all([
    supabase.from("properties").select("id, market_value").is("deleted_at", null),
    supabase
      .from("property_valuations")
      .select("property_id, market_value, valued_on")
      .order("valued_on", { ascending: true }),
  ]);
  const firstByProp = new Map<string, number>();
  for (const v of vals ?? []) {
    if (!firstByProp.has(v.property_id as string)) {
      firstByProp.set(v.property_id as string, Number(v.market_value));
    }
  }
  let valor = 0;
  let compra = 0;
  for (const p of props ?? []) {
    if (!firstByProp.has(p.id as string)) continue;
    valor += Number(p.market_value ?? 0);
    compra += firstByProp.get(p.id as string) ?? 0;
  }
  return {
    valor,
    valuedCount: firstByProp.size,
    total: (props ?? []).length,
    plusvalia: compra > 0 ? (valor - compra) / compra : null,
    ganancia: valor - compra,
  };
}

/**
 * Per-building profitability. NOI = renta esperada (contratos activos) − gastos
 * del periodo asignados a ese edificio. Cap rate = NOI anualizado / valor de
 * mercado. Fiscal: lo comercial causa IVA 16%; lo residencial es exento; los
 * arrendatarios empresa de unidades comerciales retienen 10% de ISR.
 * (Estimaciones — confírmalo con contador.)
 */
export async function getProfitability(
  period?: string,
): Promise<{ period: string; buildings: BuildingProfit[]; totals: ProfitTotals }> {
  const supabase = await createClient();
  const p = period ?? currentPeriod();

  const [{ data: props }, { data: units }, { data: leases }, { data: exps }] =
    await Promise.all([
      supabase.from("properties").select("id, name, colonia, municipio, ciudad, market_value").is("deleted_at", null),
      supabase.from("units").select("id, property_id, status, rent_amount, m2").is("deleted_at", null),
      supabase
        .from("leases")
        .select("rent_amount, tenant_is_company, unit:units(property_id, use_type)")
        .eq("status", "active")
        .is("deleted_at", null),
      supabase.from("expenses").select("amount, property_id").eq("period_month", p).is("deleted_at", null),
    ]);

  const empty = (
    id: string, name: string, mv: number | null,
    colonia: string | null, municipio: string | null, ciudad: string | null,
  ): BuildingProfit => ({
    property_id: id, name, colonia, municipio, ciudad,
    market_value: mv, m2: 0, rentPerM2: null, units: 0, occupied: 0, occupancy: 0,
    rentaPotencial: 0, ocupacionIngresos: 0,
    ingresoEsperado: 0, ingresoComercial: 0, ingresoResidencial: 0, gastos: 0,
    noi: 0, capRate: null, ivaEstimado: 0, retencionEstimada: 0,
  });

  const map = new Map<string, BuildingProfit>();
  for (const pr of props ?? [])
    map.set(pr.id, empty(pr.id, pr.name, pr.market_value ?? null, pr.colonia ?? null, pr.municipio ?? null, pr.ciudad ?? null));
  for (const u of units ?? []) {
    const b = map.get(u.property_id);
    if (!b) continue;
    b.units += 1;
    b.rentaPotencial += Number(u.rent_amount ?? 0);
    b.m2 += Number(u.m2 ?? 0);
    if (u.status === "occupied") b.occupied += 1;
  }
  for (const l of leases ?? []) {
    const unit = (l as unknown as { unit?: { property_id: string | null; use_type: string } }).unit;
    const b = unit?.property_id ? map.get(unit.property_id) : null;
    if (!b) continue;
    const rent = Number(l.rent_amount);
    b.ingresoEsperado += rent;
    if (unit?.use_type === "commercial") {
      b.ingresoComercial += rent;
      b.ivaEstimado += rent * IVA_RATE;
    } else {
      b.ingresoResidencial += rent;
    }
    // Retención de ISR: aplica al arrendamiento comercial con arrendatario empresa
    // (consistente con el IVA, que también es solo comercial).
    if (l.tenant_is_company && unit?.use_type === "commercial") {
      b.retencionEstimada += rent * RET_RATE;
    }
  }
  let gastosGenerales = 0;
  for (const e of exps ?? []) {
    if (e.property_id && map.has(e.property_id)) map.get(e.property_id)!.gastos += Number(e.amount);
    else gastosGenerales += Number(e.amount);
  }

  const buildings = [...map.values()];
  for (const b of buildings) {
    b.noi = b.ingresoEsperado - b.gastos;
    b.rentPerM2 = b.m2 > 0 ? b.ingresoEsperado / b.m2 : null;
    b.occupancy = b.units > 0 ? b.occupied / b.units : 0;
    b.ocupacionIngresos = b.rentaPotencial > 0 ? b.ingresoEsperado / b.rentaPotencial : 0;
    b.capRate = b.market_value && b.market_value > 0 ? (b.noi * 12) / b.market_value : null;
  }
  buildings.sort((a, b) => b.ingresoEsperado - a.ingresoEsperado);

  const sum = (f: (b: BuildingProfit) => number) => buildings.reduce((s, b) => s + f(b), 0);
  const ingresoEsperado = sum((b) => b.ingresoEsperado);
  const gastosTotal = sum((b) => b.gastos) + gastosGenerales;
  const totalUnits = sum((b) => b.units);
  const totalOccupied = sum((b) => b.occupied);
  const rentaPotencial = sum((b) => b.rentaPotencial);

  return {
    period: p,
    buildings,
    totals: {
      ingresoEsperado,
      gastos: gastosTotal,
      gastosGenerales,
      noi: ingresoEsperado - gastosTotal,
      ivaEstimado: sum((b) => b.ivaEstimado),
      retencionEstimada: sum((b) => b.retencionEstimada),
      units: totalUnits,
      occupied: totalOccupied,
      occupancy: totalUnits > 0 ? totalOccupied / totalUnits : 0,
      rentaPotencial,
      ocupacionIngresos: rentaPotencial > 0 ? ingresoEsperado / rentaPotencial : 0,
    },
  };
}
