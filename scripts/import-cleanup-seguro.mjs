// Limpieza SEGURA (sin riesgo): nombres reales + 2 rentas placeholder obvias.
// NO toca las rentas con IVA ni ocupación (esas se confirman aparte).
// Correr: node --env-file=.env.local scripts/import-cleanup-seguro.mjs
import { readFileSync } from "fs";
import { createClient } from "@supabase/supabase-js";
const a = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});
const padron = JSON.parse(readFileSync("scripts/padron.json", "utf8"));
const digits = (s) => parseInt(String(s).replace(/\D/g, ""), 10);
const norm = (s) => (s ?? "").toString().normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
const esJunk = (n) => !n || norm(n).length < 4 || /^l+$/i.test(norm(n).replace(/\s/g, ""));

const { data: leases } = await a
  .from("leases")
  .select("id, tenant_profile_id, rent_amount, unit:units(label, property:properties(name)), tenant:profiles(full_name)")
  .eq("status", "active")
  .is("deleted_at", null);
const byKey = new Map();
for (const l of leases ?? []) {
  const prop = l.unit?.property?.name, lab = l.unit?.label;
  if (prop && lab) byKey.set(prop + "#" + digits(lab), l);
}

// 1) Nombres
let nombres = 0;
const skipNombres = [];
for (const row of padron) {
  const l = byKey.get(row.prop + "#" + row.offices[0]);
  if (!l || !l.tenant_profile_id) continue;
  const real = row.persona;
  if (esJunk(real)) { skipNombres.push(`${l.unit.label} (padrón: "${real}")`); continue; }
  if (norm(l.tenant?.full_name) === norm(real)) continue;
  const { error } = await a.from("profiles").update({ full_name: real }).eq("id", l.tenant_profile_id);
  if (error) { console.log(`  ✗ ${l.unit.label}: ${error.message}`); continue; }
  console.log(`  ✓ ${l.unit.label.padEnd(9)} → ${real}`);
  nombres++;
}

// 2) Dos rentas placeholder obvias
const RENTAS = [["COV", 206, 14020], ["COV", 207, 15720]];
let rentas = 0;
for (const [prop, of_, monto] of RENTAS) {
  const l = byKey.get(prop + "#" + of_);
  if (!l) continue;
  const { error } = await a.from("leases").update({ rent_amount: monto }).eq("id", l.id);
  if (error) { console.log(`  ✗ ${l.unit.label}: ${error.message}`); continue; }
  console.log(`  ✓ ${l.unit.label.padEnd(9)} renta → $${monto.toLocaleString()}`);
  rentas++;
}

console.log(`\n${nombres} nombres + ${rentas} rentas corregidas.`);
if (skipNombres.length) console.log("Nombres saltados (padrón dudoso):", skipNombres.join(" · "));
