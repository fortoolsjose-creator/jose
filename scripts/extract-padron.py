# Extrae el padrón real (RENTAS MARZO 2026) y lo escribe como JSON para el diff.
import openpyxl, os, sys, json, unicodedata, re
sys.stdout.reconfigure(encoding="utf-8", errors="replace")
DL = r"C:\Users\harro\Downloads"
path = os.path.join(DL, [f for f in os.listdir(DL) if f.startswith("SEGUIMIENTO RENTAS")][0])

PROP = {"covarrubias":"COV","cobarruvias":"COV","ameyalco":"AME","campeche":"Campeche",
        "isola":"Isola","medellin":"Medellín","medellín":"Medellín","rena":"Rena",
        "naves":"Naves","andalucia":"Andalucía","alisos":"Alisos"}
def norm(s):
    return "".join(c for c in unicodedata.normalize("NFD", str(s)) if unicodedata.category(c)!="Mn").lower().strip()

wb = openpyxl.load_workbook(path, read_only=True, data_only=True)
ws = wb["RENTAS MARZO 2026"]
building = None
rows = []
for r in ws.iter_rows(values_only=True):
    edif, ofi, pers, monto, efe, tra, pago, fact = (list(r)+[None]*8)[:8]
    if edif and norm(edif) in PROP:
        building = PROP[norm(edif)]
    if ofi is None or not building:
        continue
    offices = [int(x) for x in re.findall(r"\d+", str(ofi))]
    if not offices or not isinstance(monto, (int, float)):
        continue
    metodo = "efectivo" if (efe and norm(efe) not in ("no","")) else ("transferencia" if tra else None)
    rows.append({
        "prop": building, "offices": offices, "raw_of": str(ofi).strip(),
        "persona": str(pers).strip() if pers else None,
        "monto": float(monto),
        "metodo": metodo,
        "factura": bool(fact) and norm(fact) not in ("no","n/a",""),
    })
wb.close()
out = r"C:\Users\harro\llave\scripts\padron.json"
with open(out, "w", encoding="utf-8") as f:
    json.dump(rows, f, ensure_ascii=False, indent=1)
print(f"Padrón marzo 2026: {len(rows)} renglones -> {out}")
for x in rows[:6]:
    print(" ", x["prop"], x["raw_of"], "|", x["persona"], "| $"+str(int(x["monto"])), "|", x["metodo"], "| fact:", x["factura"])
