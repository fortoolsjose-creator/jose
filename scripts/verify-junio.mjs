// Solo lectura. Muestra cuánto "vencido" había con la regla vieja vs la nueva
// (la renta del mes en curso ya NO cuenta como vencida).
// Correr: node --env-file=.env.local scripts/verify-junio.mjs
import { createClient } from "@supabase/supabase-js";

const a = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

const CURRENT = "2026-06"; // mes en curso (hoy es 2026-06-22)
const day = 86_400_000;
const daysOverdue = (due) => {
  if (!due) return 0;
  const d = Math.floor((Date.now() - new Date(due + "T00:00:00Z").getTime()) / day);
  return d > 0 ? d : 0;
};
const overdueOld = (p) => {
  const bal = Number(p.amount_due) - Number(p.amount_paid);
  if (bal <= 0) return false;
  return p.status === "overdue" || (!!p.due_date && p.status !== "paid" && daysOverdue(p.due_date) > 0);
};
const overdueNew = (p) => {
  const bal = Number(p.amount_due) - Number(p.amount_paid);
  if (bal <= 0) return false;
  if (p.period_month && p.period_month.slice(0, 7) >= CURRENT) return false; // gracia mes en curso
  return p.status === "overdue" || (!!p.due_date && p.status !== "paid" && daysOverdue(p.due_date) > 0);
};

const { data, error } = await a
  .from("payments")
  .select("lease_id, amount_due, amount_paid, status, due_date, period_month")
  .is("deleted_at", null);
if (error) { console.error(error.message); process.exit(1); }

const sum = (rows) => rows.reduce((s, r) => s + (Number(r.amount_due) - Number(r.amount_paid)), 0);
const oldR = data.filter(overdueOld);
const newR = data.filter(overdueNew);
const fmt = (n) => "$" + Math.round(n).toLocaleString("es-MX");

console.log(`Pagos totales: ${data.length}`);
console.log(`\nREGLA VIEJA  -> vencido: ${fmt(sum(oldR))}  | deudores: ${new Set(oldR.map((r) => r.lease_id)).size}`);
console.log(`REGLA NUEVA  -> vencido: ${fmt(sum(newR))}  | deudores: ${new Set(newR.map((r) => r.lease_id)).size}`);
const junio = data.filter((r) => r.period_month?.slice(0, 7) === CURRENT);
console.log(`\nPagos de junio (mes en curso): ${junio.length} — ahora salen como "por cobrar", no "vencido".`);
