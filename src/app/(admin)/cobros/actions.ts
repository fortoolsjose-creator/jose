"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/app/_lib/supabase/server";
import { getProfile } from "@/app/_lib/dal";
import { generateReceiptPdf } from "@/app/_lib/receipts";
import { formatMonth, formatDate } from "@/app/_lib/format";
import { PAYMENT_METHOD_LABELS } from "@/app/_lib/types";
import { notify } from "@/app/_lib/notifications";
import { sendPaymentReminders } from "@/app/_lib/reminders";
import { isPeriodLocked } from "@/app/_lib/data/period-locks";

export type Result = { ok?: true; error?: string };

const confirmSchema = z.object({
  method: z.enum(["spei", "cash", "oxxo", "card", "other"]),
  reference: z.string().optional(),
  amount: z.coerce.number().min(0),
  paid_date: z.string().min(1),
  fiscal_status: z.enum(["con_factura", "sin_factura", "pendiente"]).optional(),
});

const moraSchema = z.object({
  mora_tasa_mensual: z.coerce.number().min(0).max(100),
  mora_dias_gracia: z.coerce.number().int().min(0).max(60),
});

export async function setMoraConfig(input: unknown): Promise<Result> {
  const profile = await getProfile();
  if (!profile || profile.role !== "owner")
    return { error: "Solo el dueño puede configurar el cargo moratorio." };
  const parsed = moraSchema.safeParse(input);
  if (!parsed.success) return { error: "Datos no válidos." };
  const supabase = await createClient();
  const { error } = await supabase
    .from("organizations")
    .update({
      mora_tasa_mensual: parsed.data.mora_tasa_mensual,
      mora_dias_gracia: parsed.data.mora_dias_gracia,
    })
    .eq("id", profile.org_id);
  if (error) return { error: "No se pudo guardar. ¿Ya corriste el SQL de moratorios en Supabase?" };
  revalidatePath("/cobros");
  revalidatePath("/reportes");
  return { ok: true };
}

export async function confirmPayment(
  paymentId: string,
  input: unknown,
  proofPath?: string | null,
): Promise<Result> {
  const profile = await getProfile();
  if (!profile || profile.role === "tenant") return { error: "No autorizado." };
  const parsed = confirmSchema.safeParse(input);
  if (!parsed.success) return { error: "Revisa los datos del pago." };
  const d = parsed.data;
  const supabase = await createClient();
  const validProof =
    typeof proofPath === "string" && proofPath.startsWith(`${profile.org_id}/`)
      ? proofPath
      : null;

  const { data: p } = await supabase
    .from("payments")
    .select(
      "id, amount_due, period_month, lease:leases(tenant_profile_id, tenant_is_company, unit:units(label, use_type, property:properties(name)), tenant:profiles(full_name, email))",
    )
    .eq("id", paymentId)
    .maybeSingle();
  if (!p) return { error: "Pago no encontrado." };
  if (await isPeriodLocked(supabase, profile.org_id, p.period_month as string)) {
    return { error: "Ese mes ya está cerrado. Pídele al dueño reabrirlo para registrar cobros." };
  }

  const lease = (p as unknown as { lease?: {
    tenant_profile_id: string | null;
    tenant_is_company: boolean;
    unit: { label: string; use_type: string; property: { name: string } | null } | null;
    tenant: { full_name: string | null; email: string | null } | null;
  } }).lease;

  if (d.amount <= 0) return { error: "El monto del abono debe ser mayor a cero." };

  // Anti-duplicado (doble click / reintento): mismo monto, fecha y autor.
  const { data: dup } = await supabase
    .from("payment_allocations")
    .select("id")
    .eq("payment_id", paymentId)
    .eq("monto", d.amount)
    .eq("fecha", d.paid_date)
    .eq("created_by", profile.id)
    .maybeSingle();
  if (dup) return { error: "Ese abono ya se registró (evitamos duplicarlo)." };

  // Registra el pago como un ABONO (no sobreescribe; varios abonos del mismo mes
  // se suman). amount_paid se deriva de la suma de abonos.
  const { error: aErr } = await supabase.from("payment_allocations").insert({
    org_id: profile.org_id,
    payment_id: paymentId,
    monto: d.amount,
    fecha: d.paid_date,
    method: d.method,
    reference: d.reference?.trim() || null,
    created_by: profile.id,
  });
  if (aErr) return { error: "No se pudo registrar el abono." };

  const { data: allocs } = await supabase
    .from("payment_allocations")
    .select("monto")
    .eq("payment_id", paymentId);
  const round2 = (n: number) => Math.round(n * 100) / 100;
  const amountPaid = round2((allocs ?? []).reduce((s, a) => s + Number(a.monto), 0));
  const status = amountPaid >= Number(p.amount_due) ? "paid" : "partial";

  // Desglose fiscal (estimado, base de flujo): IVA 16% en comercial; retención de
  // ISR 10% cuando el arrendatario es persona moral en local comercial. Es informativo.
  const comercial = lease?.unit?.use_type === "commercial";
  const subtotal = Number(p.amount_due);
  const iva = comercial ? round2(subtotal * 0.16) : 0;
  const retencionIsr = comercial && lease?.tenant_is_company ? round2(subtotal * 0.1) : 0;

  const { error: uErr } = await supabase
    .from("payments")
    .update({
      amount_paid: amountPaid,
      paid_date: d.paid_date,
      method: d.method,
      reference: d.reference?.trim() || null,
      status,
      confirmed_by: profile.id,
      subtotal,
      iva,
      retencion_isr: retencionIsr,
      retencion_iva: 0,
      ...(validProof ? { proof_path: validProof } : {}),
      ...(d.fiscal_status
        ? {
            fiscal_status: d.fiscal_status,
            invoiced_at: d.fiscal_status === "con_factura" ? new Date().toISOString() : null,
          }
        : {}),
    })
    .eq("id", paymentId);
  if (uErr) return { error: "No se pudo registrar el pago." };

  // Generate + upload the recibo PDF (best-effort; payment is already recorded).
  try {
    const { data: org } = await supabase
      .from("organizations")
      .select("name")
      .eq("id", profile.org_id)
      .maybeSingle();

    const bytes = await generateReceiptPdf({
      folio: paymentId.slice(0, 8).toUpperCase(),
      orgName: org?.name ?? "Metros Redondos",
      tenantName: lease?.tenant?.full_name ?? lease?.tenant?.email ?? "Arrendatario",
      unitLabel: lease?.unit?.label ?? "",
      propertyName: lease?.unit?.property?.name ?? "",
      periodLabel: formatMonth(p.period_month),
      amount: d.amount,
      methodLabel: PAYMENT_METHOD_LABELS[d.method],
      paidDateLabel: formatDate(d.paid_date),
      // El desglose fiscal solo va en el recibo si el pago se facturó.
      ...(d.fiscal_status === "con_factura" ? { subtotal, iva, retencionIsr } : {}),
    });

    const path = `${profile.org_id}/${lease?.tenant_profile_id ?? "sin-arrendatario"}/${paymentId}.pdf`;
    const { error: upErr } = await supabase.storage
      .from("receipts")
      .upload(path, Buffer.from(bytes), {
        contentType: "application/pdf",
        upsert: true,
      });
    if (!upErr) {
      await supabase.from("payments").update({ receipt_pdf_url: path }).eq("id", paymentId);
    }
  } catch {
    // Receipt generation failed — the payment still counts; admin can retry.
  }

  if (status === "paid" && lease?.tenant?.email) {
    await notify({
      to: lease.tenant.email,
      template: "payment_confirmed",
      data: { period: formatMonth(p.period_month), amount: d.amount },
    });
  }

  revalidatePath("/cobros");
  revalidatePath("/panel");
  revalidatePath("/mi-renta");
  return { ok: true };
}

/** Borra un abono y recalcula el monto pagado del cobro (para corregir errores). */
export async function deleteAllocation(allocationId: string): Promise<Result> {
  const profile = await getProfile();
  if (!profile || profile.role === "tenant") return { error: "No autorizado." };
  const supabase = await createClient();
  const { data: alloc } = await supabase
    .from("payment_allocations")
    .select("payment_id")
    .eq("id", allocationId)
    .maybeSingle();
  if (!alloc) return { error: "Abono no encontrado." };
  const paymentId = alloc.payment_id as string;

  const { data: pay } = await supabase
    .from("payments")
    .select("amount_due, period_month")
    .eq("id", paymentId)
    .maybeSingle();
  if (pay && (await isPeriodLocked(supabase, profile.org_id, pay.period_month as string))) {
    return { error: "Ese mes ya está cerrado. Pídele al dueño reabrirlo." };
  }

  const { error: dErr } = await supabase.from("payment_allocations").delete().eq("id", allocationId);
  if (dErr) return { error: "No se pudo borrar el abono." };

  const { data: allocs } = await supabase
    .from("payment_allocations")
    .select("monto")
    .eq("payment_id", paymentId);
  const amountPaid = Math.round((allocs ?? []).reduce((s, a) => s + Number(a.monto), 0) * 100) / 100;
  const due = Number(pay?.amount_due ?? 0);
  const status = amountPaid <= 0 ? "pending" : amountPaid >= due ? "paid" : "partial";
  await supabase.from("payments").update({ amount_paid: amountPaid, status }).eq("id", paymentId);

  revalidatePath("/cobros");
  revalidatePath("/panel");
  revalidatePath("/mi-renta");
  return { ok: true };
}

export async function getReceiptUrl(
  path: string,
): Promise<{ url?: string; error?: string }> {
  const profile = await getProfile();
  if (!profile) return { error: "No autorizado." };
  const supabase = await createClient();
  const { data, error } = await supabase.storage
    .from("receipts")
    .createSignedUrl(path, 120);
  if (error || !data) return { error: "No se pudo abrir el recibo." };
  return { url: data.signedUrl };
}

export async function getProofUrl(
  path: string,
): Promise<{ url?: string; error?: string }> {
  const profile = await getProfile();
  if (!profile || profile.role === "tenant") return { error: "No autorizado." };
  const supabase = await createClient();
  const { data, error } = await supabase.storage
    .from("documents")
    .createSignedUrl(path, 120);
  if (error || !data) return { error: "No se pudo abrir el comprobante." };
  return { url: data.signedUrl };
}

export async function sendRemindersAction(): Promise<{
  ok?: true;
  error?: string;
  sent?: number;
}> {
  const profile = await getProfile();
  if (!profile || profile.role === "tenant") return { error: "No autorizado." };
  const { sent } = await sendPaymentReminders();
  return { ok: true, sent };
}
