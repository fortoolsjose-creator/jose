# Parses MI RECEPCION DE RENTAS 2026.xlsx into a clean JSON for loading into Llave.
import pandas as pd, re, json
from collections import defaultdict

SRC = r"C:\Users\harro\Downloads\MI RECEPCION DE RENTAS 2026.xlsx"
OUT = r"C:\Users\harro\llave\scripts\import-data.json"

# Friendly building names where we are confident (from the egresos sheet); others
# keep the code prefix and the user renames in the app.
PREFIX_NAME = {
    "ALI": "Alisos", "ANDA": "Andalucía", "CAM": "Campeche", "MED": "Medellín",
    "NAV": "Naves", "REN": "Rena", "ISOC": "Isola", "COV": "COV (por confirmar)",
    "COVEST": "COV — Estacionamientos", "AME": "AME (por confirmar)",
}
EXCLUDE = ("BRIVE", "BRVE", "TOTAL", "REEMB")

def is_code(s):
    if not isinstance(s, str): return False
    s = s.strip().upper()
    if any(x in s for x in EXCLUDE): return False
    return bool(re.match(r"^[A-Z]{2,6}\s?\d", s)) or s.startswith("NAV")

def to_num(v):
    if isinstance(v, bool): return None
    if isinstance(v, (int, float)):
        return None if (isinstance(v, float) and v != v) else float(v)
    if isinstance(v, str):
        m = re.search(r"\d[\d,]*\.?\d*", v.replace(",", ""))
        if m:
            try: return float(m.group())
            except: return None
    return None

def is_name(v):
    if not isinstance(v, str): return False
    v = v.strip()
    if not v or v == "·": return False
    if v.upper() in ("DISPONIBLE", "PAGADO", "ATRASADO", "RETRASADO", "RETRASO"): return False
    if to_num(v) is not None and not re.search(r"[A-Za-z]{2,}", v): return False
    return True

units = {}  # key -> dict
sheets = pd.read_excel(SRC, sheet_name=None, header=None)
for nm, df in sheets.items():
    for _, row in df.iterrows():
        code_cell = row[1] if len(row) > 1 else None
        if not is_code(code_cell):
            continue
        code = str(code_cell).strip()
        key = code.upper().replace(" ", "")
        tenant = row[2] if len(row) > 2 else None
        rent = to_num(row[4]) if len(row) > 4 else None
        disponible = isinstance(tenant, str) and tenant.strip().upper() == "DISPONIBLE"
        name = str(tenant).strip() if is_name(tenant) else None

        u = units.get(key, {"code": code, "rent": None, "tenant": None, "disponible": False})
        if rent and (u["rent"] is None or rent > 0):
            u["rent"] = rent
        if name and not u["tenant"]:
            u["tenant"] = name
        if disponible:
            u["disponible"] = True
        units[key] = u

# Build output
props = defaultdict(list)
for key, u in units.items():
    m = re.match(r"^([A-Z]+)", key)
    prefix = m.group(1) if m else "OTROS"
    if u["tenant"]:
        status = "occupied"
    elif u["disponible"]:
        status = "vacant"
    elif u["rent"]:
        status = "occupied"   # has rent but no recorded name
    else:
        status = "vacant"
    props[prefix].append({
        "code": u["code"], "rent": u["rent"] or 0,
        "tenant": u["tenant"], "status": status,
    })

data = {"properties": []}
for prefix in sorted(props):
    data["properties"].append({
        "prefix": prefix,
        "name": PREFIX_NAME.get(prefix, prefix),
        "units": sorted(props[prefix], key=lambda x: x["code"]),
    })

with open(OUT, "w", encoding="utf-8") as f:
    json.dump(data, f, ensure_ascii=False, indent=2)

# Summary
tot = sum(len(p["units"]) for p in data["properties"])
occ = sum(1 for p in data["properties"] for u in p["units"] if u["status"] == "occupied")
vac = tot - occ
named = sum(1 for p in data["properties"] for u in p["units"] if u["tenant"])
print(f"Edificios: {len(data['properties'])}  |  Unidades: {tot}  |  Ocupadas: {occ}  |  Disponibles: {vac}  |  Con nombre de inquilino: {named}")
for p in data["properties"]:
    o = sum(1 for u in p['units'] if u['status']=='occupied')
    print(f"  {p['prefix']:7} {p['name']:24} {len(p['units']):2} unidades ({o} ocupadas)")
print("JSON ->", OUT)
