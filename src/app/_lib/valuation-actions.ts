"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/app/_lib/supabase/admin";
import { getProfile } from "@/app/_lib/dal";

/** Registra una valuación de la propiedad y actualiza su valor vigente. */
export async function addValuation(
  propertyId: string,
  input: { market_value: number; valued_on: string; source?: string },
): Promise<{ ok?: true; error?: string }> {
  const profile = await getProfile();
  if (!profile || profile.role !== "owner") return { error: "Solo el dueño puede registrar valuaciones." };
  const value = Number(input.market_value);
  if (!Number.isFinite(value) || value <= 0) return { error: "Valor no válido." };
  if (!input.valued_on) return { error: "Selecciona la fecha." };

  const admin = createAdminClient();
  const { data: prop } = await admin
    .from("properties")
    .select("id, org_id")
    .eq("id", propertyId)
    .maybeSingle();
  if (!prop || prop.org_id !== profile.org_id) return { error: "Propiedad no válida." };

  const { error } = await admin.from("property_valuations").insert({
    org_id: prop.org_id,
    property_id: propertyId,
    valued_on: input.valued_on,
    market_value: value,
    source: input.source?.trim() || null,
  });
  if (error) return { error: "No se pudo guardar la valuación." };

  // El valor vigente de la propiedad = la valuación más reciente.
  await admin.from("properties").update({ market_value: value }).eq("id", propertyId);

  revalidatePath(`/propiedades/${propertyId}`);
  revalidatePath("/rentabilidad");
  revalidatePath("/reportes");
  return { ok: true };
}
