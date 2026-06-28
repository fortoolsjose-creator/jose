// Tier 2: marca como VACANTE las unidades que Magaly confirmó vacías.
// Termina el contrato activo (status 'ended') y pone la unidad en 'vacant'.
// Correr: node --env-file=.env.local scripts/import-vacantes.mjs
import { createClient } from "@supabase/supabase-js";
const a = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

// [propiedad, oficina]
const VAC = [
  ["COV", 204],
  ["COV", 305],
  ["COV", 308],
  ["COV", 304],
  ["Campeche", 602],
];

const digits = (s) => parseInt(String(s).replace(/\D/g, ""), 10);
let ok = 0;
const miss = [];
for (const [prop, of_] of VAC) {
  const { data: p } = await a.from("properties").select("id").eq("name", prop).is("deleted_at", null).maybeSingle();
  if (!p) { miss.push(`prop ${prop}`); continue; }
  const { data: units } = await a.from("units").select("id, label").eq("property_id", p.id).is("deleted_at", null);
  const u = (units || []).find((x) => digits(x.label) === of_);
  if (!u) { miss.push(`${prop} of.${of_}`); continue; }
  const { data: leases } = await a.from("leases").select("id").eq("unit_id", u.id).eq("status", "active").is("deleted_at", null);
  for (const l of leases || []) {
    await a.from("leases").update({ status: "ended" }).eq("id", l.id);
  }
  const { error } = await a.from("units").update({ status: "vacant" }).eq("id", u.id);
  if (error) { miss.push(`${prop} ${u.label}: ${error.message}`); continue; }
  console.log(`  ✓ ${u.label.padEnd(9)} marcada VACANTE (${(leases || []).length} contrato terminado)`);
  ok++;
}
console.log(`\n${ok} unidades marcadas vacantes.`);
if (miss.length) console.log("Sin aplicar:", miss.join(" · "));
