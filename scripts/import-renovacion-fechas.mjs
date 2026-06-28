// Importa la fecha de renovación (vigencia) por oficina a leases.end_date.
// Datos de la pestaña CALENDARIO DE RENOVACIONES (generado por gen-renovacion-fechas.py).
// Solo contratos activos. Idempotente. Correr: node --env-file=.env.local scripts/import-renovacion-fechas.mjs
import { createClient } from "@supabase/supabase-js";
const a = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

// [propiedad, oficina, fecha de renovación YYYY-MM-DD]
const FECHAS = [
  ["COV", 201, "2026-10-31"],
  ["COV", 202, "2026-09-30"],
  ["COV", 203, "2026-09-30"],
  ["COV", 207, "2026-09-30"],
  ["COV", 208, "2026-04-30"],
  ["COV", 210, "2026-04-30"],
  ["COV", 301, "2026-06-30"],
  ["COV", 302, "2026-06-30"],
  ["COV", 303, "2026-06-30"],
  ["COV", 305, "2026-01-31"],
  ["COV", 306, "2026-09-30"],
  ["COV", 308, "2026-03-31"],
  ["COV", 311, "2026-01-31"],
  ["COV", 204, "2026-04-14"],
  ["COV", 205, "2026-04-14"],
  ["COV", 206, "2026-06-14"],
  ["COV", 209, "2026-07-14"],
  ["COV", 307, "2026-04-21"],
  ["COV", 310, "2026-01-22"],
  ["COV", 312, "2026-05-14"],
  ["AME", 1, "2025-11-30"],
  ["AME", 2, "2025-11-30"],
  ["AME", 5, "2026-06-30"],
  ["AME", 7, "2026-06-14"],
  ["AME", 8, "2026-06-30"],
  ["AME", 10, "2029-04-30"],
  ["AME", 4, "2026-07-24"],
  ["AME", 9, "2026-10-14"],
  ["AME", 11, "2026-02-14"],
  ["AME", 12, "2026-02-14"],
  ["Campeche", 601, "2026-09-30"],
  ["Campeche", 602, "2026-02-28"],
  ["Campeche", 603, "2026-06-30"],
  ["Isola", 202, "2026-06-30"],
  ["Isola", 301, "2026-03-31"],
  ["Isola", 1841, "2026-04-24"],
  ["Medellín", 304, "2026-06-30"],
  ["Medellín", 305, "2026-10-15"],
  ["Rena", 402, "2026-07-14"],
  ["Naves", 14, "2026-09-30"],
  ["Naves", 4, "2026-10-24"],
  ["Naves", 13, "2026-09-14"],
  ["Andalucía", 4, "2026-06-14"],
  ["Alisos", 21, "2026-09-15"],
];

const digits = (s) => parseInt(String(s).replace(/\D/g, ""), 10);
const byProp = {};
for (const [prop, of_, date] of FECHAS) (byProp[prop] ||= []).push([of_, date]);

let ok = 0;
const miss = [];
for (const [prop, rows] of Object.entries(byProp)) {
  const { data: p } = await a.from("properties").select("id").eq("name", prop).is("deleted_at", null).maybeSingle();
  if (!p) { miss.push(`propiedad "${prop}"`); continue; }
  const { data: units } = await a.from("units").select("id, label").eq("property_id", p.id).is("deleted_at", null);
  for (const [of_, date] of rows) {
    const u = (units || []).find((x) => digits(x.label) === of_);
    if (!u) { miss.push(`${prop} of.${of_}`); continue; }
    const { data: leases } = await a.from("leases").select("id").eq("unit_id", u.id).eq("status", "active").is("deleted_at", null);
    const lease = (leases || [])[0];
    if (!lease) { miss.push(`${prop} ${u.label} (sin contrato)`); continue; }
    const { error } = await a.from("leases").update({ end_date: date }).eq("id", lease.id);
    if (error) { miss.push(`${prop} ${u.label}: ${error.message}`); continue; }
    console.log(`  \u2713 ${u.label.padEnd(9)} renueva ${date}`);
    ok++;
  }
}
console.log(`\n${ok} contratos con fecha de renovación.`);
if (miss.length) console.log("Sin aplicar:", miss.join(" \u00b7 "));
