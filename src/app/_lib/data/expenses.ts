import "server-only";
import { createClient } from "@/app/_lib/supabase/server";
import type { Expense } from "@/app/_lib/types";

export type ExpenseRow = Expense & { property: { name: string } | null };

export async function listExpenses(opts: {
  month?: string;
  propertyId?: string;
}): Promise<ExpenseRow[]> {
  const supabase = await createClient();
  let q = supabase
    .from("expenses")
    .select("*, property:properties(name)")
    .is("deleted_at", null);
  if (opts.month) q = q.eq("period_month", opts.month);
  if (opts.propertyId) q = q.eq("property_id", opts.propertyId);
  const { data } = await q.order("expense_date", { ascending: false });
  return (data ?? []) as unknown as ExpenseRow[];
}

export async function listExpenseMonths(): Promise<string[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("expenses")
    .select("period_month")
    .is("deleted_at", null);
  const set = new Set<string>(
    (data ?? []).map((r) => r.period_month).filter(Boolean) as string[],
  );
  return [...set].sort().reverse();
}

export async function expensesTotal(month?: string): Promise<number> {
  const supabase = await createClient();
  let q = supabase.from("expenses").select("amount").is("deleted_at", null);
  if (month) q = q.eq("period_month", month);
  const { data } = await q;
  return (data ?? []).reduce((s, r) => s + Number(r.amount), 0);
}
