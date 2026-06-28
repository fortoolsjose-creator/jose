# Lee CONTROL DE EGRESOS y muestra cómo se cargarían (NO carga nada).
import pandas as pd, unicodedata

SRC = r"C:\Users\harro\Downloads\CONTROL DE EGRESOS 2026.xlsx"

def norm(s):
    s = "".join(c for c in unicodedata.normalize("NFD", str(s)) if unicodedata.category(c) != "Mn")
    return s.lower().strip()

# nombre en el Excel -> propiedad en el sistema
PROP = {
    "andalucia": "Andalucía", "isola": "Isola", "medellin": "Medellín",
    "campeche": "Campeche", "rena": "Rena", "alisos": "Alisos",
    "nave": "Naves", "cov": "COV (por confirmar)",
}

def map_prop(name):
    n = norm(name)
    for k, v in PROP.items():
        if k in n:
            return v
    return None

def category(name):
    n = norm(name)
    if "basura" in n or "telmex" in n or "telcel" in n:
        return "servicios"
    if "imss" in n or "sipare" in n:
        return "nomina"
    if "isn" in n:
        return "impuestos"
    if "admin" in n:
        return "administracion"
    # cualquier nombre de edificio -> mantenimiento
    if map_prop(name):
        return "mantenimiento"
    return "otro"

def num(v):
    if isinstance(v, (int, float)) and not (isinstance(v, float) and v != v):
        return float(v)
    return None

df = pd.read_excel(SRC, sheet_name=0, header=None)
SKIP = ("total", "t. egreso", "nn", "mantenimientos", "forma pago")

rows = []
for _, r in df.iterrows():
    name = r[1] if len(r) > 1 else None
    amt = num(r[3]) if len(r) > 3 else None  # columna CANTIDAD
    if not isinstance(name, str):
        continue
    nm = name.strip()
    if not nm or any(s in norm(nm) for s in SKIP) or amt is None or amt == 0:
        continue
    rows.append((nm, amt, category(nm), map_prop(nm)))

print(f"{'CONCEPTO':22} {'MONTO':>11}  {'CATEGORÍA':14}  EDIFICIO")
print("-" * 74)
total = 0
unmapped = []
for nm, amt, cat, prop in rows:
    total += amt
    tag = prop if prop else "General (sin edificio)"
    flag = "  <-- revisar" if (not prop) else ""
    print(f"{nm[:22]:22} {amt:>11,.0f}  {cat:14}  {tag}{flag}")
    if not prop:
        unmapped.append(nm)
print("-" * 74)
print(f"{'TOTAL MENSUAL':22} {total:>11,.0f}   ({len(rows)} conceptos)")
if unmapped:
    print("\nSin edificio claro (irian a 'General'):", ", ".join(unmapped))
print("\nNOTA: tomé la columna CANTIDAD como el gasto MENSUAL de cada concepto.")
