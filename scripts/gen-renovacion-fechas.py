# Extrae fechas de renovación de la pestaña CALENDARIO DE RENOVACIONES y emite triples.
import openpyxl, os, sys, re, datetime, calendar, unicodedata
sys.stdout.reconfigure(encoding="utf-8", errors="replace")
DL = r"C:\Users\harro\Downloads"
path = os.path.join(DL, [f for f in os.listdir(DL) if f.startswith("SEGUIMIENTO RENTAS")][0])

PROP = {"covarrubias":"COV","cobarruvias":"COV","ameyalco":"AME","campeche":"Campeche",
        "isola":"Isola","medellin":"Medellín","rena":"Rena","naves":"Naves",
        "andalucia":"Andalucía","alisos":"Alisos","sph":"Naves"}
MESAB = {"ene":1,"feb":2,"mar":3,"abr":4,"may":5,"jun":6,"jul":7,"ago":8,"sep":9,
         "sept":9,"oct":10,"nov":11,"dic":12}
def norm(s):
    return "".join(c for c in unicodedata.normalize("NFD", str(s)) if unicodedata.category(c)!="Mn").lower().strip()

def parse_fecha(v):
    if isinstance(v, datetime.datetime):
        return v.strftime("%Y-%m-%d")
    if isinstance(v, str):
        s = norm(v)
        m = re.match(r"(\d{1,2})[-/ ]([a-z]+)[-/ ](\d{2,4})", s)
        if m:
            d = int(m.group(1)); mon = MESAB.get(m.group(2)[:4]) or MESAB.get(m.group(2)[:3]); y = int(m.group(3))
            if mon:
                if y < 100: y += 2000
                d = min(d, calendar.monthrange(y, mon)[1])
                return f"{y:04d}-{mon:02d}-{d:02d}"
    return None

wb = openpyxl.load_workbook(path, read_only=True, data_only=True)
ws = wb["CALENDARIO DE RENOVACIONES"]
building = None
triples = []
for row in ws.iter_rows(values_only=True):
    edif, ofi, pers, fecha = row[0], row[1], row[2], row[3]
    if edif and norm(edif) in PROP:
        building = PROP[norm(edif)]
    if not building or ofi is None:
        continue
    offices = re.findall(r"\d+", str(ofi))
    f = parse_fecha(fecha)
    if not offices or not f:
        continue
    for o in offices:
        triples.append((building, int(o), f))
wb.close()

rows_js = "\n".join(f'  ["{prop}", {of_}, "{f}"],' for prop, of_, f in triples)
mjs = '''// Importa la fecha de renovación (vigencia) por oficina a leases.end_date.
// Datos de la pestaña CALENDARIO DE RENOVACIONES (generado por gen-renovacion-fechas.py).
// Solo contratos activos. Idempotente. Correr: node --env-file=.env.local scripts/import-renovacion-fechas.mjs
import { createClient } from "@supabase/supabase-js";
const a = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

// [propiedad, oficina, fecha de renovación YYYY-MM-DD]
const FECHAS = [
''' + rows_js + '''
];

const digits = (s) => parseInt(String(s).replace(/\\D/g, ""), 10);
const byProp = {};
for (const [prop, of_, date] of FECHAS) (byProp[prop] ||= []).push([of_, date]);

let ok = 0;
const miss = [];
for (const [prop, rows] of Object.entries(byProp)) {
  const { data: p } = await a.from("properties").select("id").eq("name", prop).is("deleted_at", null).maybeSingle();
  if (!p) { miss.push(`propiedad "${prop}"`); continue; }
  const { data: units } = await a.from("units").select("id, label").eq("property_id", p.id).is("deleted_at", null);
  for (const [of_, date] of rows) {
    const u = (units || []).find((x) => digits(x.label) === of_);
    if (!u) { miss.push(`${prop} of.${of_}`); continue; }
    const { data: leases } = await a.from("leases").select("id").eq("unit_id", u.id).eq("status", "active").is("deleted_at", null);
    const lease = (leases || [])[0];
    if (!lease) { miss.push(`${prop} ${u.label} (sin contrato)`); continue; }
    const { error } = await a.from("leases").update({ end_date: date }).eq("id", lease.id);
    if (error) { miss.push(`${prop} ${u.label}: ${error.message}`); continue; }
    console.log(`  \\u2713 ${u.label.padEnd(9)} renueva ${date}`);
    ok++;
  }
}
console.log(`\\n${ok} contratos con fecha de renovación.`);
if (miss.length) console.log("Sin aplicar:", miss.join(" \\u00b7 "));
'''
out = r"C:\Users\harro\llave\scripts\import-renovacion-fechas.mjs"
with open(out, "w", encoding="utf-8") as fh:
    fh.write(mjs)
print(f"Escrito {out} con {len(triples)} fechas.")
