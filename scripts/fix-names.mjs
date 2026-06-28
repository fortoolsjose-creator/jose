// Quita SOLO el sufijo " (por confirmar)" de los nombres de propiedades.
// No inventa nombres: deja la abreviatura real de la familia (AME, COV, …).
// Los nombres definitivos se ponen después de la reunión con los papás.
// Correr: node --env-file=.env.local scripts/fix-names.mjs
import { createClient } from "@supabase/supabase-js";

const a = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } },
);

const { data: props, error } = await a
  .from("properties")
  .select("id, name")
  .ilike("name", "%(por confirmar)%")
  .is("deleted_at", null);

if (error) {
  console.error("Error leyendo propiedades:", error.message);
  process.exit(1);
}

if (!props?.length) {
  console.log('No hay propiedades con "(por confirmar)". Nada que hacer.');
  process.exit(0);
}

for (const p of props) {
  const clean = p.name.replace(/\s*\(por confirmar\)\s*$/i, "").trim();
  if (clean === p.name || !clean) {
    console.log(`  (sin cambio) "${p.name}"`);
    continue;
  }
  const { error: upErr } = await a.from("properties").update({ name: clean }).eq("id", p.id);
  console.log(`  "${p.name}" -> "${clean}"${upErr ? `  ERROR: ${upErr.message}` : ""}`);
}

console.log("\nListo.");
