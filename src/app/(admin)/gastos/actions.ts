"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/app/_lib/supabase/server";
import { getProfile } from "@/app/_lib/dal";
import { isPeriodLocked } from "@/app/_lib/data/period-locks";
import { expenseSchema, type ExpenseInput } from "@/app/_lib/schemas";

export type Result = { ok?: true; error?: string };
export type Allocation = { entity_id: string; proportion: number };
const monthOf = (d: string) => (d ? d.slice(0, 7) + "-01" : null);
const round2 = (n: number) => Math.round(n * 100) / 100;

async function requireStaff() {
  const p = await getProfile();
  return !p || p.role === "tenant" ? null : p;
}

/** Inserta el reparto de un gasto compartido entre sociedades. */
async function insertAllocations(
  supabase: Awaited<ReturnType<typeof createClient>>,
  orgId: string,
  expenseId: string,
  total: number,
  allocations: Allocation[],
) {
  const rows = allocations
    .filter((a) => a.entity_id && Number(a.proportion) > 0)
    .map((a) => ({
      org_id: orgId,
      expense_id: expenseId,
      entity_id: a.entity_id,
      proportion: Number(a.proportion),
      amount: round2((Number(a.proportion) / 100) * total),
    }));
  if (rows.length) await supabase.from("expense_allocations").insert(rows);
}

function revalidate() {
  revalidatePath("/gastos");
  revalidatePath("/rentabilidad");
  revalidatePath("/rentabilidad-sociedad");
  revalidatePath("/reportes");
  revalidatePath("/panel");
}

export async function createExpense(
  input: ExpenseInput,
  allocations?: Allocation[],
): Promise<Result> {
  const profile = await requireStaff();
  if (!profile) return { error: "No autorizado." };
  const parsed = expenseSchema.safeParse(input);
  if (!parsed.success) return { error: "Revisa los datos." };
  const d = parsed.data;

  const compartido = (allocations ?? []).filter((a) => a.entity_id && Number(a.proportion) > 0);
  if (compartido.length > 0) {
    const suma = compartido.reduce((s, a) => s + Number(a.proportion), 0);
    if (Math.abs(suma - 100) > 0.5) return { error: "El reparto entre sociedades debe sumar 100%." };
  }

  const supabase = await createClient();
  if (await isPeriodLocked(supabase, profile.org_id, monthOf(d.expense_date))) {
    return { error: "Ese mes ya está cerrado. Pídele al dueño reabrirlo para registrar gastos." };
  }
  if (d.property_id && compartido.length === 0) {
    const { data: prop } = await supabase
      .from("properties")
      .select("id")
      .eq("id", d.property_id)
      .is("deleted_at", null)
      .maybeSingle();
    if (!prop) return { error: "Propiedad no válida." };
  }
  const { data: created, error } = await supabase
    .from("expenses")
    .insert({
      org_id: profile.org_id,
      // Un gasto compartido no cuelga de un solo edificio.
      property_id: compartido.length > 0 ? null : d.property_id || null,
      category: d.category,
      vendor: d.vendor?.trim() || null,
      description: d.description?.trim() || null,
      amount: d.amount,
      expense_date: d.expense_date,
      period_month: monthOf(d.expense_date),
      has_invoice: d.has_invoice ?? false,
    })
    .select("id")
    .single();
  if (error || !created) return { error: "No se pudo guardar el gasto." };

  if (compartido.length > 0) {
    await insertAllocations(supabase, profile.org_id, created.id, d.amount, compartido);
  }
  revalidate();
  return { ok: true };
}

export async function updateExpense(id: string, input: ExpenseInput): Promise<Result> {
  const profile = await requireStaff();
  if (!profile) return { error: "No autorizado." };
  const parsed = expenseSchema.safeParse(input);
  if (!parsed.success) return { error: "Revisa los datos." };
  const d = parsed.data;

  const supabase = await createClient();
  if (await isPeriodLocked(supabase, profile.org_id, monthOf(d.expense_date))) {
    return { error: "Ese mes ya está cerrado. Pídele al dueño reabrirlo para editar gastos." };
  }
  if (d.property_id) {
    const { data: prop } = await supabase
      .from("properties")
      .select("id")
      .eq("id", d.property_id)
      .is("deleted_at", null)
      .maybeSingle();
    if (!prop) return { error: "Propiedad no válida." };
  }
  const { error } = await supabase
    .from("expenses")
    .update({
      property_id: d.property_id || null,
      category: d.category,
      vendor: d.vendor?.trim() || null,
      description: d.description?.trim() || null,
      amount: d.amount,
      expense_date: d.expense_date,
      period_month: monthOf(d.expense_date),
      has_invoice: d.has_invoice ?? false,
    })
    .eq("id", id);
  if (error) return { error: "No se pudo actualizar." };

  // Si es un gasto compartido, resincroniza el monto repartido por sociedad al
  // nuevo total (las proporciones se mantienen).
  const { data: allocs } = await supabase
    .from("expense_allocations")
    .select("id, proportion")
    .eq("expense_id", id);
  for (const a of allocs ?? []) {
    await supabase
      .from("expense_allocations")
      .update({ amount: round2((Number(a.proportion) / 100) * d.amount) })
      .eq("id", a.id as string);
  }

  revalidate();
  return { ok: true };
}

export async function deleteExpense(id: string): Promise<Result> {
  const profile = await requireStaff();
  if (!profile) return { error: "No autorizado." };
  const supabase = await createClient();
  const { data: ex } = await supabase
    .from("expenses")
    .select("period_month")
    .eq("id", id)
    .maybeSingle();
  if (await isPeriodLocked(supabase, profile.org_id, (ex?.period_month as string | null) ?? null)) {
    return { error: "Ese mes ya está cerrado. Pídele al dueño reabrirlo." };
  }
  const { error } = await supabase
    .from("expenses")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id);
  if (error) return { error: "No se pudo eliminar." };
  revalidate();
  return { ok: true };
}
