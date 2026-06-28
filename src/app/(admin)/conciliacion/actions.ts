"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/app/_lib/supabase/server";
import { getProfile } from "@/app/_lib/dal";

type Result = { ok?: true; error?: string; inserted?: number };

export type ParsedTx = {
  fecha?: string | null;
  monto: number;
  referencia?: string | null;
  concepto?: string | null;
};

export async function importBankTransactions(rows: ParsedTx[]): Promise<Result> {
  const profile = await getProfile();
  if (!profile || profile.role === "tenant") return { error: "No autorizado." };
  const clean = (rows ?? [])
    .filter((r) => Number.isFinite(Number(r.monto)) && Number(r.monto) !== 0)
    .slice(0, 2000)
    .map((r) => ({
      org_id: profile.org_id,
      fecha: r.fecha || null,
      monto: Number(r.monto),
      referencia: r.referencia ? String(r.referencia).slice(0, 120) : null,
      concepto: r.concepto ? String(r.concepto).slice(0, 200) : null,
    }));
  if (!clean.length) return { error: "No se detectaron movimientos válidos en el texto pegado." };
  const supabase = await createClient();
  const { error } = await supabase.from("bank_transactions").insert(clean);
  if (error) return { error: "No se pudieron importar los movimientos." };
  revalidatePath("/conciliacion");
  return { ok: true, inserted: clean.length };
}

export async function matchTransaction(txId: string, paymentId: string): Promise<Result> {
  const profile = await getProfile();
  if (!profile || profile.role === "tenant") return { error: "No autorizado." };
  const supabase = await createClient();

  if (paymentId) {
    // El cobro debe existir y ser de la org (RLS de payments filtra por org).
    const { data: pay } = await supabase
      .from("payments")
      .select("id")
      .eq("id", paymentId)
      .maybeSingle();
    if (!pay) return { error: "Cobro no válido." };
    // Un cobro solo se casa con UN depósito.
    const { data: yaCasado } = await supabase
      .from("bank_transactions")
      .select("id")
      .eq("matched_payment_id", paymentId)
      .is("deleted_at", null)
      .neq("id", txId)
      .maybeSingle();
    if (yaCasado) return { error: "Ese cobro ya está casado con otro depósito." };
  }

  const { error } = await supabase
    .from("bank_transactions")
    .update({ matched_payment_id: paymentId || null })
    .eq("id", txId);
  if (error) return { error: "No se pudo casar el movimiento." };
  revalidatePath("/conciliacion");
  return { ok: true };
}

export async function unmatchTransaction(txId: string): Promise<Result> {
  const profile = await getProfile();
  if (!profile || profile.role === "tenant") return { error: "No autorizado." };
  const supabase = await createClient();
  const { error } = await supabase
    .from("bank_transactions")
    .update({ matched_payment_id: null })
    .eq("id", txId);
  if (error) return { error: "No se pudo desvincular." };
  revalidatePath("/conciliacion");
  return { ok: true };
}

export async function deleteTransaction(txId: string): Promise<Result> {
  const profile = await getProfile();
  if (!profile || profile.role === "tenant") return { error: "No autorizado." };
  const supabase = await createClient();
  const { error } = await supabase
    .from("bank_transactions")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", txId);
  if (error) return { error: "No se pudo eliminar." };
  revalidatePath("/conciliacion");
  return { ok: true };
}
