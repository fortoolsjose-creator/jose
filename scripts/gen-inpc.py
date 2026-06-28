# Genera src/app/_lib/inpc.ts con la tabla de INPC + helpers, desde la calculadora.
import openpyxl, os, sys, unicodedata
sys.stdout.reconfigure(encoding="utf-8", errors="replace")
DL = r"C:\Users\harro\Downloads"
path = os.path.join(DL, [f for f in os.listdir(DL) if f.startswith("RENOVACIONES CALCULA")][0])

MES = {"enero":1,"febrero":2,"marzo":3,"abril":4,"mayo":5,"junio":6,"julio":7,
       "agosto":8,"septiembre":9,"octubre":10,"noviembre":11,"diciembre":12}
def norm(s):
    return "".join(c for c in unicodedata.normalize("NFD", str(s)) if unicodedata.category(c)!="Mn").lower().strip()

wb = openpyxl.load_workbook(path, read_only=True, data_only=True)
ws = wb["Rena-INC (2)"]
rows = []
year = None; prev_m = 0
for r in ws.iter_rows(values_only=True):
    ycell, mcell, vcell = r[3], r[4], r[5]
    m = MES.get(norm(mcell)) if mcell else None
    if m is None or vcell is None or not isinstance(vcell, (int, float)):
        continue
    if isinstance(ycell, (int, float)):
        year = int(ycell)
    elif year is not None and m <= prev_m:
        year += 1
    if year is None:
        continue
    prev_m = m
    rows.append((f"{year}-{m:02d}", round(float(vcell), 4)))
wb.close()

# dedup por ym (quedarse con el último valor visto)
seen = {}
for ym, pct in rows:
    seen[ym] = pct
data = sorted(seen.items())

lines = ",\n".join(f'  {{ ym: "{ym}", pct: {pct} }}' for ym, pct in data)
ts = '''// Tabla mensual de INPC (inflación de Banxico), tomada de la calculadora de Magaly.
// `pct` = % de inflación de ESE mes. Actualizar cada mes con el dato nuevo de Banxico.
// (Generado por scripts/gen-inpc.py — no editar a mano salvo para agregar el mes nuevo.)
export type InpcRow = { ym: string; pct: number };

export const INPC_MONTHLY: InpcRow[] = [
''' + lines + '''
];

export function latestInpcYm(): string {
  return INPC_MONTHLY.length ? INPC_MONTHLY[INPC_MONTHLY.length - 1].ym : "";
}

/** Suma del INPC desde el mes SIGUIENTE a `desdeYm` hasta `hastaYm` (o el último). En %. */
export function inpcAcumulado(desdeYm: string, hastaYm?: string): number {
  const hasta = hastaYm ?? latestInpcYm();
  return INPC_MONTHLY.filter((r) => r.ym > desdeYm && r.ym <= hasta).reduce((s, r) => s + r.pct, 0);
}

export type RenovacionCalc = {
  inpcPct: number;
  margenPct: number;
  aumentoPct: number;
  nuevaRenta: number;
  nuevaCuota: number;
  nuevoTotal: number;
};

/** Renta/cuota nuevas = actuales x (1 + (INPC acumulado + margen)/100). Redondeado. */
export function calcRenovacion(
  renta: number,
  cuota: number,
  inpcPct: number,
  margenPct: number,
): RenovacionCalc {
  const aumentoPct = inpcPct + margenPct;
  const f = 1 + aumentoPct / 100;
  const nuevaRenta = Math.round(renta * f);
  const nuevaCuota = Math.round(cuota * f);
  return { inpcPct, margenPct, aumentoPct, nuevaRenta, nuevaCuota, nuevoTotal: nuevaRenta + nuevaCuota };
}
'''
out = r"C:\Users\harro\llave\src\app\_lib\inpc.ts"
with open(out, "w", encoding="utf-8") as f:
    f.write(ts)
print(f"Escrito {out} con {len(data)} meses (del {data[0][0]} al {data[-1][0]}).")
print("Últimos 6:", data[-6:])
