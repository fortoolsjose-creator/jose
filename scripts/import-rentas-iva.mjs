// Tier 2: corrige las rentas que estaban guardadas CON IVA → renta base.
// (Excluye AME10, que no cuadra ni con IVA — esa la confirma Magaly.)
// Correr: node --env-file=.env.local scripts/import-rentas-iva.mjs
import { createClient } from "@supabase/supabase-js";
const a = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

// [propiedad, oficina, renta base]
const RENTAS = [
  ["COV", 202, 14000],
  ["COV", 205, 8000],
  ["COV", 209, 12070],
  ["COV", 311, 9723],
  ["COV", 312, 15600],
  ["Medellín", 304, 7440],
  ["AME", 11, 25505],
  ["Naves", 4, 51196],
  ["Naves", 13, 46633],
  ["Naves", 14, 50400],
];

const digits = (s) => parseInt(String(s).replace(/\D/g, ""), 10);
let ok = 0;
const miss = [];
for (const [prop, of_, monto] of RENTAS) {
  const { data: p } = await a.from("properties").select("id").eq("name", prop).is("deleted_at", null).maybeSingle();
  if (!p) { miss.push(`prop ${prop}`); continue; }
  const { data: units } = await a.from("units").select("id, label").eq("property_id", p.id).is("deleted_at", null);
  const u = (units || []).find((x) => digits(x.label) === of_);
  if (!u) { miss.push(`${prop} of.${of_}`); continue; }
  const { data: leases } = await a.from("leases").select("id, rent_amount").eq("unit_id", u.id).eq("status", "active").is("deleted_at", null);
  const lease = (leases || [])[0];
  if (!lease) { miss.push(`${prop} ${u.label} (sin contrato)`); continue; }
  const { error } = await a.from("leases").update({ rent_amount: monto }).eq("id", lease.id);
  if (error) { miss.push(`${prop} ${u.label}: ${error.message}`); continue; }
  console.log(`  ✓ ${u.label.padEnd(9)} $${Math.round(lease.rent_amount).toLocaleString()} → $${monto.toLocaleString()}`);
  ok++;
}
console.log(`\n${ok} rentas corregidas a base (sin IVA).`);
if (miss.length) console.log("Sin aplicar:", miss.join(" · "));
