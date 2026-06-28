import "server-only";
import { createClient } from "@/app/_lib/supabase/server";

export type BankTx = {
  id: string;
  fecha: string | null;
  monto: number;
  referencia: string | null;
  concepto: string | null;
  matched_payment_id: string | null;
  matched: { period: string; tenant: string } | null;
};

export async function listBankTransactions(): Promise<BankTx[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("bank_transactions")
    .select(
      "id, fecha, monto, referencia, concepto, matched_payment_id, payment:payments(period_month, lease:leases(tenant:profiles(full_name, email)))",
    )
    .is("deleted_at", null)
    .order("fecha", { ascending: false })
    .limit(300);
  return (data ?? []).map((t) => {
    const row = t as unknown as {
      id: string;
      fecha: string | null;
      monto: number;
      referencia: string | null;
      concepto: string | null;
      matched_payment_id: string | null;
      payment?: { period_month: string; lease?: { tenant?: { full_name: string | null; email: string | null } } } | null;
    };
    const pay = row.payment;
    return {
      id: row.id,
      fecha: row.fecha,
      monto: Number(row.monto),
      referencia: row.referencia,
      concepto: row.concepto,
      matched_payment_id: row.matched_payment_id,
      matched: pay
        ? { period: pay.period_month, tenant: pay.lease?.tenant?.full_name ?? pay.lease?.tenant?.email ?? "Inquilino" }
        : null,
    };
  });
}

export type CandidatePayment = { id: string; amount: number; tenant: string; period: string };

/** Cobros con dinero recibido que aún no están casados con un movimiento del banco. */
export async function listCandidatePayments(): Promise<CandidatePayment[]> {
  const supabase = await createClient();
  const [{ data }, { data: matched }] = await Promise.all([
    supabase
      .from("payments")
      .select("id, amount_paid, period_month, lease:leases(tenant:profiles(full_name, email))")
      .is("deleted_at", null)
      .gt("amount_paid", 0)
      .order("paid_date", { ascending: false })
      .limit(400),
    supabase
      .from("bank_transactions")
      .select("matched_payment_id")
      .not("matched_payment_id", "is", null)
      .is("deleted_at", null),
  ]);
  const used = new Set((matched ?? []).map((m) => m.matched_payment_id as string));
  return (data ?? [])
    .filter((p) => !used.has(p.id as string))
    .map((p) => {
      const t = (p as unknown as { lease?: { tenant?: { full_name: string | null; email: string | null } } }).lease
        ?.tenant;
      return {
        id: p.id as string,
        amount: Number(p.amount_paid),
        tenant: t?.full_name ?? t?.email ?? "Inquilino",
        period: p.period_month as string,
      };
    });
}
