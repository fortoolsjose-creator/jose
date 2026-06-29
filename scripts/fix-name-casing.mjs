// Normaliza el uso de mayúsculas en los nombres de inquilinos:
//   "jorge alberto" -> "Jorge Alberto",  "MIRIAM RIVAS" -> "Miriam Rivas"
// Respeta: siglas (SPH, YAL...) en MAYÚSCULA; conectores (y, de, la...) en minúscula.
// NO inventa acentos ni apellidos. Solo cambia el que de verdad cambia.
// Correr: node --env-file=.env.local scripts/fix-name-casing.mjs
import { createClient } from "@supabase/supabase-js";
const a = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } },
);

const ACRONYMS = new Set(["sph", "yal", "cit", "ph", "cimma", "sa", "cv", "rl", "sc", "sas"]);
const CONNECTORS = new Set(["y", "e", "de", "del", "la", "las", "los", "da", "di"]);

function fix(name) {
  if (!name) return name;
  return name
    .trim()
    .split(/\s+/)
    .map((w, i) => {
      const lw = w.toLowerCase();
      if (ACRONYMS.has(lw)) return lw.toUpperCase();
      if (i > 0 && CONNECTORS.has(lw)) return lw;
      if (!/[a-záéíóúñü]/i.test(w)) return w; // signos como "/"
      return w.charAt(0).toUpperCase() + w.slice(1).toLowerCase();
    })
    .join(" ");
}

const { data: profiles } = await a.from("profiles").select("id, full_name").not("full_name", "is", null);
let n = 0;
for (const p of profiles || []) {
  const nuevo = fix(p.full_name);
  if (nuevo && nuevo !== p.full_name) {
    await a.from("profiles").update({ full_name: nuevo }).eq("id", p.id);
    console.log(`  "${p.full_name}"  ->  "${nuevo}"`);
    n++;
  }
}
console.log(`\n✅ ${n} nombre(s) pulidos.`);
