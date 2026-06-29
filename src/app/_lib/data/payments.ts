import "server-only";
import { createClient } from "@/app/_lib/supabase/server";
import { getProfile } from "@/app/_lib/dal";
import type { PaymentStatus, PaymentMethod, FiscalStatus } from "@/app/_lib/types";

const pad = (n: number) => String(n).padStart(2, "0");
const monthStart = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-01`;

/**
 * Generate-on-view: makes sure every ACTIVE lease has a payment row for the
 * current month, and flips past-due unpaid rows to "overdue". Idempotent
 * (unique (lease_id, period_month)). Call this when loading money screens.
 */
export async function ensureCurrentPayments(): Promise<void> {
  const profile = await getProfile();
  if (!profile || profile.role === "tenant") return;
  const supabase = await createClient();
  const now = new Date();
  const periodMonth = monthStart(now);

  const { data: leases } = await supabase
    .from("leases")
    .select("id, rent_amount, payment_day")
    .eq("status", "active")
    .is("deleted_at", null);

  if (leases && leases.length > 0) {
    const rows = leases.map((l) => ({
      org_id: profile.org_id,
      lease_id: l.id,
      period_month: periodMonth,
      amount_due: l.rent_amount,
      due_date: `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(Math.min(l.payment_day, 28))}`,
      status: "pending" as const,
    }));
    await supabase
      .from("payments")
      .upsert(rows, { onConflict: "lease_id,period_month", ignoreDuplicates: true });
  }

  const today = now.toISOString().slice(0, 10);
  await supabase
    .from("payments")
    .update({ status: "overdue" })
    .eq("status", "pending")
    .eq("amount_paid", 0)
    .lt("due_date", today)
    .is("deleted_at", null);
}

export type PaymentRow = {
  id: string;
  period_month: string;
  amount_due: number;
  amount_paid: number;
  due_date: string | null;
  paid_date: string | null;
  method: PaymentMethod | null;
  reference: string | null;
  status: PaymentStatus;
  fiscal_status: FiscalStatus;
  receipt_pdf_url: string | null;
  proof_path: string | null;
  tenant_reference: string | null;
  tenant_marked_paid_at: string | null;
  lease: {
    payment_day: number;
    unit: { label: string; property: { name: string } | null } | null;
    tenant: { full_name: string | null; email: string | null } | null;
  } | null;
  recibio: { full_name: string | null } | null;
};

export async function listPayments(opts: {
  month?: string;
  status?: string;
}): Promise<PaymentRow[]> {
  const supabase = await createClient();
  let q = supabase
    .from("payments")
    .select(
      "id, period_month, amount_due, amount_paid, due_date, paid_date, method, reference, status, fiscal_status, receipt_pdf_url, proof_path, tenant_reference, tenant_marked_paid_at, lease:leases(payment_day, unit:units(label, property:properties(name)), tenant:profiles(full_name, email)), recibio:profiles!confirmed_by(full_name)",
    )
    .is("deleted_at", null);
  if (opts.month) q = q.eq("period_month", opts.month);
  if (opts.status) q = q.eq("status", opts.status);
  const { data } = await q
    .order("due_date", { ascending: true, nullsFirst: false });
  return (data ?? []) as unknown as PaymentRow[];
}

export type DashboardStats = {
  cobrado: number;
  pendiente: number;
  vencidos: number;
  periodMonth: string;
};

export async function dashboardStats(): Promise<DashboardStats> {
  const supabase = await createClient();
  const periodMonth = monthStart(new Date());
  const { data } = await supabase
    .from("payments")
    .select("amount_due, amount_paid, status, period_month")
    .is("deleted_at", null);
  const rows = data ?? [];
  const thisMonth = rows.filter((r) => r.period_month === periodMonth);
  const cobrado = thisMonth.reduce((s, r) => s + Number(r.amount_paid), 0);
  const pendiente = thisMonth.reduce(
    (s, r) => s + Math.max(0, Number(r.amount_due) - Number(r.amount_paid)),
    0,
  );
  const vencidos = rows.filter((r) => r.status === "overdue").length;
  return { cobrado, pendiente, vencidos, periodMonth };
}

/** Distinct period_months present, newest first, for the month filter. */
export async function listPaymentMonths(): Promise<string[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("payments")
    .select("period_month")
    .is("deleted_at", null);
  const set = new Set<string>((data ?? []).map((r) => r.period_month as string));
  return [...set].sort().reverse();
}
