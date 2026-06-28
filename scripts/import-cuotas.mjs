// Importa la cuota de mantenimiento (Mtto) por oficina a leases.maintenance_fee.
// Datos de la hoja INMUEBLES del Excel de la asistente (columna Mtto). Solo
// aplica a contratos ACTIVOS (las vacías no llevan cuota). Idempotente.
// Correr: node --env-file=.env.local scripts/import-cuotas.mjs
import { createClient } from "@supabase/supabase-js";
const a = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

// [oficina, cuota mensual de mantenimiento]
const DATA = {
  COV: [
    [201, 1270], [202, 2500], [204, 1500], [205, 2000], [206, 1500], [207, 2675],
    [208, 4100], [209, 2170], [301, 1248], [302, 1248], [303, 1248], [304, 2800],
    [305, 1100], [306, 2000], [307, 1700], [308, 2200], [309, 3000], [310, 1100],
    [311, 2000], [312, 3700],
  ],
  "Medellín": [[304, 2140], [305, 1200]],
  Rena: [[402, 3208]],
  AME: [
    [1, 4100], [3, 1660], [4, 3154], [5, 1604], [6, 1200], [7, 2100],
    [8, 3315], [9, 3750], [10, 1800], [11, 2125],
  ],
  Isola: [[202, 5500], [301, 4300]],
  Campeche: [[601, 1170], [602, 3000], [603, 2673]],
  Alisos: [[21, 6600]],
  "Andalucía": [[4, 6900]],
  Naves: [[4, 5000], [21, 5000], [13, 4000], [14, 4500]],
};

const digits = (s) => parseInt(String(s).replace(/\D/g, ""), 10);
let ok = 0;
let totalCuota = 0;
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
  for (const [of_, mtto] of rows) {
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
    const { error } = await a.from("leases").update({ maintenance_fee: mtto }).eq("id", lease.id);
    if (error) {
      miss.push(`${prop} ${u.label}: ${error.message}`);
      continue;
    }
    console.log(`  ✓ ${u.label.padEnd(9)} cuota $${mtto.toLocaleString()}`);
    totalCuota += mtto;
    ok++;
  }
}

console.log(`\n${ok} contratos con cuota de mantenimiento · $${totalCuota.toLocaleString()}/mes en total.`);
if (miss.length) console.log("Sin aplicar (vacías o sin unidad):", miss.join(" · "));
