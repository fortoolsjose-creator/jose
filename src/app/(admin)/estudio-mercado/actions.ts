"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/app/_lib/supabase/server";
import { getProfile } from "@/app/_lib/dal";

const num = (v: unknown): number | null => {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 ? n : null;
};

export async function setUnitMarket(
  unitId: string,
  input: { min?: unknown; avg?: unknown; max?: unknown },
): Promise<{ ok?: true; error?: string }> {
  const profile = await getProfile();
  if (!profile || profile.role === "tenant") return { error: "No autorizado." };
  const supabase = await createClient();
  // La RLS de units limita la escritura a la org del staff.
  const { error } = await supabase
    .from("units")
    .update({
      rent_market_min: num(input.min),
      rent_market_avg: num(input.avg),
      rent_market_max: num(input.max),
      rent_market_source: "Captura manual",
      rent_market_updated_at: new Date().toISOString(),
    })
    .eq("id", unitId);
  if (error) return { error: "No se pudo guardar." };
  revalidatePath("/estudio-mercado");
  revalidatePath("/reportes");
  return { ok: true };
}
