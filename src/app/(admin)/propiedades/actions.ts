"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/app/_lib/supabase/server";
import { getProfile } from "@/app/_lib/dal";
import {
  propertySchema,
  unitSchema,
  type PropertyInput,
  type UnitInput,
} from "@/app/_lib/schemas";

export type Result = { ok?: true; error?: string };

const clean = (v?: string) => {
  const t = (v ?? "").trim();
  return t === "" ? null : t;
};

async function requireStaff() {
  const profile = await getProfile();
  if (!profile || profile.role === "tenant") return null;
  return profile;
}

// ---- Properties ----------------------------------------------------------
export async function createProperty(input: PropertyInput): Promise<Result> {
  const profile = await requireStaff();
  if (!profile) return { error: "No autorizado." };
  const parsed = propertySchema.safeParse(input);
  if (!parsed.success) return { error: "Revisa los datos." };
  const d = parsed.data;

  const supabase = await createClient();
  const { error } = await supabase.from("properties").insert({
    org_id: profile.org_id,
    name: d.name,
    type: d.type,
    street: clean(d.street),
    ext_number: clean(d.ext_number),
    int_number: clean(d.int_number),
    colonia: clean(d.colonia),
    municipio: clean(d.municipio),
    ciudad: clean(d.ciudad),
    cp: clean(d.cp),
    notes: clean(d.notes),
    market_value: d.market_value && d.market_value > 0 ? d.market_value : null,
    purchase_price: d.purchase_price && d.purchase_price > 0 ? d.purchase_price : null,
    purchase_date: clean(d.purchase_date),
    clabe: clean(d.clabe),
    banco: clean(d.banco),
    titular: clean(d.titular),
    entity_id: d.entity_id || null,
  });
  if (error) return { error: "No se pudo guardar la propiedad." };
  revalidatePath("/propiedades");
  return { ok: true };
}

export async function updateProperty(
  id: string,
  input: PropertyInput,
): Promise<Result> {
  if (!(await requireStaff())) return { error: "No autorizado." };
  const parsed = propertySchema.safeParse(input);
  if (!parsed.success) return { error: "Revisa los datos." };
  const d = parsed.data;

  const supabase = await createClient();
  const { error } = await supabase
    .from("properties")
    .update({
      name: d.name,
      type: d.type,
      street: clean(d.street),
      ext_number: clean(d.ext_number),
      int_number: clean(d.int_number),
      colonia: clean(d.colonia),
      municipio: clean(d.municipio),
      ciudad: clean(d.ciudad),
      cp: clean(d.cp),
      notes: clean(d.notes),
      market_value: d.market_value && d.market_value > 0 ? d.market_value : null,
      purchase_price: d.purchase_price && d.purchase_price > 0 ? d.purchase_price : null,
      purchase_date: clean(d.purchase_date),
      clabe: clean(d.clabe),
      banco: clean(d.banco),
      titular: clean(d.titular),
      entity_id: d.entity_id || null,
    })
    .eq("id", id);
  if (error) return { error: "No se pudo actualizar." };
  revalidatePath("/propiedades");
  revalidatePath(`/propiedades/${id}`);
  return { ok: true };
}

export async function deleteProperty(id: string): Promise<Result> {
  if (!(await requireStaff())) return { error: "No autorizado." };
  const supabase = await createClient();
  const { error } = await supabase
    .from("properties")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id);
  if (error) return { error: "No se pudo eliminar." };
  revalidatePath("/propiedades");
  return { ok: true };
}

// ---- Units ---------------------------------------------------------------
export async function createUnit(
  propertyId: string,
  input: UnitInput,
): Promise<Result> {
  const profile = await requireStaff();
  if (!profile) return { error: "No autorizado." };
  const parsed = unitSchema.safeParse(input);
  if (!parsed.success) return { error: "Revisa los datos." };
  const d = parsed.data;

  const supabase = await createClient();
  const { error } = await supabase.from("units").insert({
    org_id: profile.org_id,
    property_id: propertyId,
    label: d.label,
    bedrooms: d.bedrooms ?? null,
    bathrooms: d.bathrooms ?? null,
    rent_amount: d.rent_amount,
    deposit_amount: d.deposit_amount,
    status: d.status,
    use_type: d.use_type,
  });
  if (error) return { error: "No se pudo crear la unidad." };
  revalidatePath(`/propiedades/${propertyId}`);
  return { ok: true };
}

export async function updateUnit(
  id: string,
  propertyId: string,
  input: UnitInput,
): Promise<Result> {
  if (!(await requireStaff())) return { error: "No autorizado." };
  const parsed = unitSchema.safeParse(input);
  if (!parsed.success) return { error: "Revisa los datos." };
  const d = parsed.data;

  const supabase = await createClient();
  const { error } = await supabase
    .from("units")
    .update({
      label: d.label,
      bedrooms: d.bedrooms ?? null,
      bathrooms: d.bathrooms ?? null,
      rent_amount: d.rent_amount,
      deposit_amount: d.deposit_amount,
      status: d.status,
      use_type: d.use_type,
    })
    .eq("id", id);
  if (error) return { error: "No se pudo actualizar la unidad." };
  revalidatePath(`/propiedades/${propertyId}`);
  return { ok: true };
}

export async function deleteUnit(
  id: string,
  propertyId: string,
): Promise<Result> {
  if (!(await requireStaff())) return { error: "No autorizado." };
  const supabase = await createClient();
  const { error } = await supabase
    .from("units")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id);
  if (error) return { error: "No se pudo eliminar la unidad." };
  revalidatePath(`/propiedades/${propertyId}`);
  return { ok: true };
}
