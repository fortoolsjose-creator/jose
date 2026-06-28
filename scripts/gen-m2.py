# Extrae M2 por oficina de la hoja INMUEBLES y emite el DATA para import-m2.mjs.
import openpyxl, os, sys
sys.stdout.reconfigure(encoding="utf-8", errors="replace")
PATH = r"C:\Users\harro\Downloads\_docs_asistente\Administracion\METROS REDONDOS ADMÓN BASE.xlsx"

PROP = {"COBARRUVIAS":"COV","COBARRUBIAS":"COV","MEDELLIN":"Medellín","RENA":"Rena",
        "AMEYALCO":"AME","ISOLA":"Isola","CAMPECHE":"Campeche","ALISOS":"Alisos",
        "ANDALUCIA":"Andalucía","SPH":"Naves"}

wb = openpyxl.load_workbook(PATH, read_only=True, data_only=True)
ws = wb["INMUEBLES"]

def num(v):
    return v if isinstance(v, (int, float)) else None

building = None
data = {}
for row in ws.iter_rows(values_only=True):
    r = list(row)[:9]
    c0 = r[0]
    # Encabezado de edificio
    if isinstance(c0, str) and c0.strip() and num(r[3]) is None and num(r[4]) is None:
        key = c0.strip().upper()
        building = PROP.get(key)
        continue
    of = c0
    m2 = num(r[3])
    if of is not None and m2 and building and str(of).strip().upper() != "TOTAL":
        # numero de oficina: extrae dígitos
        digits = "".join(ch for ch in str(of) if ch.isdigit())
        if digits:
            data.setdefault(building, []).append((int(digits), round(float(m2), 2)))

# Emite DATA JS
print("const DATA = {")
for prop, items in data.items():
    # dedup por oficina
    seen = {}
    for of, m2 in items:
        seen[of] = m2
    pairs = ", ".join(f"[{of}, {m2}]" for of, m2 in sorted(seen.items()))
    q = f'"{prop}"' if any(c in prop for c in "áéíóú") else prop
    print(f"  {q}: [{pairs}],")
print("};")
wb.close()
