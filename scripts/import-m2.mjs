// Importa el metraje (m²) por oficina a units.m2. Datos de la hoja INMUEBLES
// (generados por gen-m2.py). Mapea por edificio + número de oficina. Idempotente.
// Correr: node --env-file=.env.local scripts/import-m2.mjs
import { createClient } from "@supabase/supabase-js";
const a = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

const DATA = {
  COV: [[201, 6.34], [202, 6.87], [203, 10.4], [204, 8.6], [205, 11.13], [206, 21.71], [207, 25.88], [208, 30.28], [209, 21.15], [210, 30.28], [301, 7.72], [302, 12.69], [303, 10.8], [304, 21.9], [305, 5.84], [306, 5.84], [307, 3.0], [308, 11.0], [309, 16.08], [310, 7.05], [311, 7.45], [312, 30.55]],
  "Medellín": [[304, 11.95], [305, 5.84]],
  Rena: [[402, 68.67]],
  AME: [[1, 30.0], [2, 30.0], [3, 5.52], [4, 30.67], [5, 18.51], [6, 17.58], [7, 17.58], [8, 25.0], [9, 25.0], [10, 12.1], [11, 61.34]],
  Isola: [[202, 74.0], [301, 115.0]],
  Campeche: [[601, 51.7], [602, 78.0], [603, 62.0]],
  Alisos: [[21, 12.0]],
  "Andalucía": [[4, 271.3]],
  Naves: [[4, 569.0], [13, 569.0], [14, 569.0], [21, 457.0]],
};

const digits = (s) => parseInt(String(s).replace(/\D/g, ""), 10);
let ok = 0;
const miss = [];
for (const [prop, rows] of Object.entries(DATA)) {
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
  for (const [of_, m2] of rows) {
    const u = (units || []).find((x) => digits(x.label) === of_);
    if (!u) {
      miss.push(`${prop} of.${of_}`);
      continue;
    }
    const { error } = await a.from("units").update({ m2 }).eq("id", u.id);
    if (error) {
      miss.push(`${prop} of.${of_}: ${error.message}`);
      continue;
    }
    console.log(`  ✓ ${u.label.padEnd(9)} ${m2} m²`);
    ok++;
  }
}
console.log(`\n${ok} unidades con m².`);
if (miss.length) console.log("Sin mapear:", miss.join(" · "));
