// SOLO LECTURA: compara el padrón real (padron.json) contra la plataforma.
// Correr: node --env-file=.env.local scripts/diff-padron.mjs
import { readFileSync } from "fs";
import { createClient } from "@supabase/supabase-js";
const a = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});
const padron = JSON.parse(readFileSync("scripts/padron.json", "utf8"));
const digits = (s) => parseInt(String(s).replace(/\D/g, ""), 10);
const norm = (s) =>
  (s ?? "").toString().normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();

const { data: leases } = await a
  .from("leases")
  .select("id, rent_amount, unit:units(label, property:properties(name)), tenant:profiles(full_name)")
  .eq("status", "active")
  .is("deleted_at", null);

const byKey = new Map();
for (const l of leases ?? []) {
  const prop = l.unit?.property?.name;
  const lab = l.unit?.label;
  if (prop && lab) byKey.set(prop + "#" + digits(lab), l);
}

// Vacantes confirmadas por Magaly (junio 2026)
const VACANTES = ["COV#204", "COV#305", "COV#308", "COV#304", "COV#310", "AME#3", "AME#6", "Campeche#602"];

const nombres = [], rentas = [], sinmatch = [];
for (const row of padron) {
  const l = byKey.get(row.prop + "#" + row.offices[0]);
  if (!l) {
    sinmatch.push(`${row.prop} ${row.raw_of} — ${row.persona} ($${Math.round(row.monto)})`);
    continue;
  }
  const lab = l.unit.label;
  const platName = l.tenant?.full_name || "(sin nombre)";
  const platRent = Math.round(Number(l.rent_amount));
  const realRent = Math.round(row.monto);
  if (norm(platName) !== norm(row.persona)) nombres.push(`${lab.padEnd(9)} "${platName}" → "${row.persona}"`);
  if (platRent !== realRent) rentas.push(`${lab.padEnd(9)} $${platRent.toLocaleString()} → $${realRent.toLocaleString()}`);
}

const ocup = [];
for (const v of VACANTES) {
  const l = byKey.get(v);
  if (l) ocup.push(`${l.unit.label.padEnd(9)} contrato activo (${l.tenant?.full_name}, $${Math.round(l.rent_amount).toLocaleString()}) → marcar VACANTE`);
  else ocup.push(`${v.replace("#", " ")} — ya está sin contrato activo ✓`);
}

const p = (t, arr) => { console.log(`\n=== ${t} (${arr.length}) ===`); arr.forEach((x) => console.log("  " + x)); };
p("NOMBRES a corregir", nombres);
p("RENTAS a corregir", rentas);
p("OCUPACIÓN (vacantes de Magaly)", ocup);
p("Padrón sin unidad en la plataforma", sinmatch);
