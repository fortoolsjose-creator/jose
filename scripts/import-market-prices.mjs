// Importa precios de mercado (mín/prom/máx) a cada unidad.
// Datos extraídos de la hoja "PRECIOS MPM" del Excel de la asistente y verificados
// contra M2 + rentas actuales. Solo entran las oficinas con dato limpio.
// Mapea por edificio + número de oficina dentro de la etiqueta (COV201 -> 201).
// Idempotente. Correr: node --env-file=.env.local scripts/import-market-prices.mjs
import { createClient } from "@supabase/supabase-js";
const a = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});
const today = new Date().toISOString();
const SRC = "Estudio de mercado MPM (asistente)";

// [oficina, máx, prom, mín]
const DATA = {
  COV: [
    [201, 10146, 9512, 8878], [202, 10081, 9738, 8982], [203, 12590, 12070, 11100],
    [204, 10100, 9740, 8880], [205, 13701, 12900, 10403], [206, 18868, 17782, 15829],
    [207, 25708, 23379, 21001], [208, 28091, 26274, 23246], [209, 18868, 17783, 14860],
    [210, 28091, 26274, 23246], [301, 10901, 10203, 9740], [302, 14255, 13405, 12200],
    [303, 13128, 12588, 11300], [304, 20400, 17040, 14120], [305, 9802, 9042, 8108],
    [306, 10016, 8000, 7940], [307, 7100, 6200, 5300], [308, 13400, 12650, 11500],
    [309, 16346, 15500, 13952], [310, 10603, 10061, 7445], [311, 10881, 10261, 8500],
  ],
  AME: [
    [1, 25000, 23500, 21393], [3, 8499, 8002, 7600], [4, 25001, 23500, 20500],
    [5, 17625, 16725, 16026], [6, 24054, 18780, 14192], [8, 23750, 21750, 19500],
    [9, 23750, 21750, 18750], [10, 14000, 13200, 12100], [11, 28125, 26625, 20527],
  ],
  Campeche: [
    [601, 23600, 20600, 17350], [602, 28007, 23000, 22500], [603, 24500, 21459, 20529],
  ],
  "Medellín": [
    [305, 8000, 7500, 7200],
  ],
  Isola: [
    [202, 25501, 23506, 21501], [301, 35827, 30375, 26350],
  ],
  Rena: [
    [402, 30003, 27036, 20005],
  ],
  Alisos: [
    [21, 16006, 15000, 13200],
  ],
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
    miss.push(`propiedad "${prop}" no encontrada`);
    continue;
  }
  const { data: units } = await a
    .from("units")
    .select("id, label")
    .eq("property_id", p.id)
    .is("deleted_at", null);
  for (const [of_, max, prom, min] of rows) {
    const u = (units || []).find((x) => digits(x.label) === of_);
    if (!u) {
      miss.push(`${prop} of.${of_}`);
      continue;
    }
    const { error } = await a
      .from("units")
      .update({
        rent_market_min: min,
        rent_market_avg: prom,
        rent_market_max: max,
        rent_market_source: SRC,
        rent_market_updated_at: today,
      })
      .eq("id", u.id);
    if (error) {
      miss.push(`${prop} of.${of_}: ${error.message}`);
      continue;
    }
    console.log(`  ✓ ${u.label.padEnd(9)} mín $${min.toLocaleString()}  prom $${prom.toLocaleString()}  máx $${max.toLocaleString()}`);
    ok++;
  }
}

console.log(`\n${ok} unidades con precio de mercado.`);
if (miss.length) console.log("Sin mapear (revisar con asistente):", miss.join(" · "));
