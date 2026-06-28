import "server-only";
import { createClient } from "@/app/_lib/supabase/server";
import { getProfile } from "@/app/_lib/dal";
import type { PaymentStatus, PaymentMethod } from "@/app/_lib/types";

const pad = (n: number) => String(n).padStart(2, "0");
const monthStart = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-01`;

/**
 * Generate-on-view de cuotas de mantenimiento: 1 cargo por mes por contrato
 * activo con `maintenance_fee > 0`. Idempotente (unique lease_id, period_month).
 * Es el espejo de ensureCurrentPayments() pero para las cuotas (aparte de la renta).
 */
export async function ensureCurrentMaintenanceFees(): Promise<void> {
  const profile = await getProfile();
  if (!profile || profile.role === "tenant") return;
  const supabase = await createClient();
  const now = new Date();
  const period = monthStart(now);

  const { data: leases } = await supabase
    .from("leases")
    .select("id, maintenance_fee, payment_day")
    .eq("status", "active")
    .gt("maintenance_fee", 0)
    .is("deleted_at", null);

  if (leases && leases.length > 0) {
    const rows = leases.map((l) => ({
      org_id: profile.org_id,
      lease_id: l.id,
      period_month: period,
      amount_due: l.maintenance_fee,
      due_date: `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(Math.min(l.payment_day, 28))}`,
      status: "pending" as const,
    }));
    await supabase
      .from("maintenance_fees")
      .upsert(rows, { onConflict: "lease_id,period_month", ignoreDuplicates: true });
  }

  const today = now.toISOString().slice(0, 10);
  await supabase
    .from("maintenance_fees")
    .update({ status: "overdue" })
    .eq("status", "pending")
    .eq("amount_paid", 0)
    .lt("due_date", today)
    .is("deleted_at", null);
}

export type FeeRow = {
  id: string;
  period_month: string;
  amount_due: number;
  amount_paid: number;
  due_date: string | null;
  paid_date: string | null;
  method: PaymentMethod | null;
  status: PaymentStatus;
  lease: {
    unit: { label: string; property: { name: string } | null } | null;
    tenant: { full_name: string | null; email: string | null } | null;
  } | null;
};

export async function listMaintenanceFees(opts: { month?: string }): Promise<FeeRow[]> {
  const supabase = await createClient();
  let q = supabase
    .from("maintenance_fees")
    .select(
      "id, period_month, amount_due, amount_paid, due_date, paid_date, method, status, lease:leases(unit:units(label, property:properties(name)), tenant:profiles(full_name, email))",
    )
    .is("deleted_at", null);
  if (opts.month) q = q.eq("period_month", opts.month);
  const { data } = await q.order("due_date", { ascending: true, nullsFirst: false });
  return (data ?? []) as unknown as FeeRow[];
}

export async function listFeeMonths(): Promise<string[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("maintenance_fees")
    .select("period_month")
    .is("deleted_at", null);
  const set = new Set<string>((data ?? []).map((r) => r.period_month as string));
  return [...set].sort().reverse();
}
