"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/app/_lib/supabase/server";
import { getProfile } from "@/app/_lib/dal";

type Result = { ok?: true; error?: string };

export async function createEntity(input: {
  nombre: string;
  rfc?: string;
  regimen?: string;
}): Promise<Result> {
  const profile = await getProfile();
  if (!profile || profile.role === "tenant") return { error: "No autorizado." };
  const nombre = (input.nombre ?? "").trim();
  if (!nombre) return { error: "Escribe el nombre de la sociedad." };
  const supabase = await createClient();
  const { error } = await supabase.from("legal_entities").insert({
    org_id: profile.org_id,
    nombre,
    rfc: input.rfc?.trim() || null,
    regimen: input.regimen?.trim() || null,
  });
  if (error) return { error: "No se pudo crear la sociedad." };
  revalidatePath("/entidades");
  return { ok: true };
}

export async function deleteEntity(id: string): Promise<Result> {
  const profile = await getProfile();
  if (!profile || profile.role === "tenant") return { error: "No autorizado." };
  const supabase = await createClient();
  const { error } = await supabase
    .from("legal_entities")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id);
  if (error) return { error: "No se pudo eliminar." };
  revalidatePath("/entidades");
  return { ok: true };
}
