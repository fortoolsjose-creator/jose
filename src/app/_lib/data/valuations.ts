import "server-only";
import { createClient } from "@/app/_lib/supabase/server";

export type Valuation = {
  id: string;
  valued_on: string;
  market_value: number;
  source: string | null;
};

export type Plusvalia = {
  first: Valuation;
  latest: Valuation;
  plusvalia: number;
  pct: number;
} | null;

export async function listValuations(propertyId: string): Promise<Valuation[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("property_valuations")
    .select("id, valued_on, market_value, source")
    .eq("property_id", propertyId)
    .order("valued_on", { ascending: false });
  return (data ?? []) as Valuation[];
}

/**
 * Ganancia de capital = valor actual − precio de compra.
 * `annualPct` solo se calcula si hay fecha de compra y ≥ medio año de tenencia.
 */
export function capitalGain(
  purchase: number | null,
  purchaseDate: string | null,
  valorActual: number | null,
  asOf: string | null,
): { ganancia: number; pct: number; annualPct: number | null } | null {
  if (!purchase || purchase <= 0 || valorActual == null) return null;
  const ganancia = valorActual - purchase;
  const pct = ganancia / purchase;
  let annualPct: number | null = null;
  if (purchaseDate && asOf) {
    const years =
      (new Date(asOf).getTime() - new Date(purchaseDate).getTime()) /
      (365.25 * 86_400_000);
    if (years >= 0.5 && valorActual > 0) {
      annualPct = Math.pow(valorActual / purchase, 1 / years) - 1;
    }
  }
  return { ganancia, pct, annualPct };
}

/** Plusvalía = valor más reciente − valor inicial (primera valuación). */
export function plusvaliaFrom(vals: Valuation[]): Plusvalia {
  if (vals.length < 2) return null;
  const sorted = [...vals].sort((a, b) => (a.valued_on < b.valued_on ? -1 : 1));
  const first = sorted[0];
  const latest = sorted[sorted.length - 1];
  const plusvalia = Number(latest.market_value) - Number(first.market_value);
  const base = Number(first.market_value);
  return { first, latest, plusvalia, pct: base > 0 ? plusvalia / base : 0 };
}
