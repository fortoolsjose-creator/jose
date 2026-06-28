// Importa el cobro de estacionamiento por oficina a leases.parking_fee.
// Datos de la columna "Estacionamiento" de la hoja INMUEBLES. Solo contratos
// activos. Idempotente. Correr: node --env-file=.env.local scripts/import-estacionamiento.mjs
import { createClient } from "@supabase/supabase-js";
const a = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

// [propiedad, oficina, estacionamiento mensual]
const DATA = [
  ["COV", 206, 1700],
  ["COV", 207, 1200],
  ["COV", 311, 2400],
  ["AME", 11, 1595],
];

const digits = (s) => parseInt(String(s).replace(/\D/g, ""), 10);
let ok = 0;
const miss = [];
for (const [prop, of_, parking] of DATA) {
  const { data: p } = await a
    .from("properties")
    .select("id")
    .eq("name", prop)
    .is("deleted_at", null)
    .maybeSingle();
  if (!p) {
    miss.push(`propiedad "${prop}"`);
    continue;
  }
  const { data: units } = await a
    .from("units")
    .select("id, label")
    .eq("property_id", p.id)
    .is("deleted_at", null);
  const u = (units || []).find((x) => digits(x.label) === of_);
  if (!u) {
    miss.push(`${prop} of.${of_} (sin unidad)`);
    continue;
  }
  const { data: leases } = await a
    .from("leases")
    .select("id")
    .eq("unit_id", u.id)
    .eq("status", "active")
    .is("deleted_at", null);
  const lease = (leases || [])[0];
  if (!lease) {
    miss.push(`${prop} ${u.label} (sin contrato activo)`);
    continue;
  }
  const { error } = await a.from("leases").update({ parking_fee: parking }).eq("id", lease.id);
  if (error) {
    miss.push(`${prop} ${u.label}: ${error.message}`);
    continue;
  }
  console.log(`  ✓ ${u.label.padEnd(9)} estacionamiento $${parking.toLocaleString()}`);
  ok++;
}
console.log(`\n${ok} contratos con estacionamiento.`);
if (miss.length) console.log("Sin aplicar:", miss.join(" · "));
