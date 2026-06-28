import "server-only";
import { createClient } from "@/app/_lib/supabase/server";

export type MarketStudyRow = {
  unitId: string;
  label: string;
  property: string;
  current: number; // renta del contrato activo, o la renta de la unidad
  min: number | null;
  avg: number | null;
  max: number | null;
  source: string | null;
};

/** Todas las unidades con su renta actual y su precio de mercado (editable). */
export async function listMarketStudy(): Promise<MarketStudyRow[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("units")
    .select(
      "id, label, rent_amount, rent_market_min, rent_market_avg, rent_market_max, rent_market_source, property:properties(name), leases(rent_amount, status)",
    )
    .is("deleted_at", null);

  const rows: MarketStudyRow[] = (data ?? []).map((u) => {
    const unit = u as unknown as {
      id: string;
      label: string;
      rent_amount: number;
      rent_market_min: number | null;
      rent_market_avg: number | null;
      rent_market_max: number | null;
      rent_market_source: string | null;
      property?: { name: string } | null;
      leases?: { rent_amount: number; status: string }[] | null;
    };
    const active = (unit.leases ?? []).find((l) => l.status === "active");
    const current = Number(active?.rent_amount ?? unit.rent_amount) || 0;
    return {
      unitId: unit.id,
      label: unit.label,
      property: unit.property?.name ?? "",
      current,
      min: unit.rent_market_min,
      avg: unit.rent_market_avg,
      max: unit.rent_market_max,
      source: unit.rent_market_source,
    };
  });

  rows.sort((a, b) => (a.property + a.label).localeCompare(b.property + b.label));
  return rows;
}
