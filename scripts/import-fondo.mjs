// Importa el saldo base del fondo de mantenimiento por edificio (provisional).
// Fuente: "FONDO DE MANTENIMIENTO 2026 (pendiente ajuste-).xlsx", hoja CONCENTRADO,
// columna "Fondo de mantenimiento", corte Mayo 2026. Idempotente.
// Correr: node --env-file=.env.local scripts/import-fondo.mjs
import { createClient } from "@supabase/supabase-js";
const a = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});
const NOTE = "Corte Mayo 2026 (provisional)";

// [propiedad, saldo base del fondo]. Campeche/Medellín/Naves no tienen dato aún.
const DATA = [
  ["COV", 230638],
  ["AME", 58413],
  ["Isola", 10032],
  ["Alisos", 6190],
  ["Andalucía", 4294],
  ["Rena", 4050],
];

let ok = 0;
const miss = [];
for (const [prop, base] of DATA) {
  const { data: p } = await a
    .from("properties")
    .select("id")
    .eq("name", prop)
    .is("deleted_at", null)
    .maybeSingle();
  if (!p) {
    miss.push(prop);
    continue;
  }
  const { error } = await a
    .from("properties")
    .update({ maintenance_fund_opening: base, maintenance_fund_opening_note: NOTE })
    .eq("id", p.id);
  if (error) {
    miss.push(`${prop}: ${error.message}`);
    continue;
  }
  console.log(`  ✓ ${prop.padEnd(10)} saldo base $${base.toLocaleString()}`);
  ok++;
}
console.log(`\n${ok} edificios con saldo base de fondo (provisional).`);
if (miss.length) console.log("Sin aplicar:", miss.join(" · "));
