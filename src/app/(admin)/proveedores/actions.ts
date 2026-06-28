"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/app/_lib/supabase/server";
import { getProfile } from "@/app/_lib/dal";

export async function createProvider(input: {
  name: string;
  service_type?: string;
  phone?: string;
  email?: string;
  notes?: string;
}): Promise<{ ok?: true; error?: string }> {
  const profile = await getProfile();
  if (!profile || profile.role === "tenant") return { error: "No autorizado." };
  const name = (input.name ?? "").trim();
  if (!name) return { error: "Escribe el nombre del proveedor." };
  const supabase = await createClient();
  const { error } = await supabase.from("providers").insert({
    org_id: profile.org_id,
    name,
    service_type: input.service_type?.trim() || null,
    phone: input.phone?.trim() || null,
    email: input.email?.trim() || null,
    notes: input.notes?.trim() || null,
  });
  if (error) return { error: "No se pudo guardar el proveedor." };
  revalidatePath("/proveedores");
  return { ok: true };
}

export async function deleteProvider(id: string): Promise<{ ok?: true; error?: string }> {
  const profile = await getProfile();
  if (!profile || profile.role === "tenant") return { error: "No autorizado." };
  const supabase = await createClient();
  const { error } = await supabase
    .from("providers")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id);
  if (error) return { error: "No se pudo eliminar." };
  revalidatePath("/proveedores");
  return { ok: true };
}
