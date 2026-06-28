# Muestra N°, Proceso y las columnas de la derecha (tiempo, archivo, frecuencia...).
import openpyxl, os, sys

sys.stdout.reconfigure(encoding="utf-8", errors="replace")
DL = r"C:\Users\harro\Downloads"
_m = [f for f in os.listdir(DL) if f.startswith("Procesos") and f.endswith(".xlsx")]
PATH = os.path.join(DL, _m[0])

wb = openpyxl.load_workbook(PATH, read_only=True, data_only=True)
ws = wb["PROCESOS"]

def c(v):
    return "" if v is None else str(v).replace("\n", " ").strip()

rows = list(ws.iter_rows(values_only=True))
# Encabezado (fila 13 -> index 12): muestra TODAS las columnas con texto
print("=== ENCABEZADOS (col : texto) ===")
for j, v in enumerate(rows[12][:29]):
    if c(v):
        print(f"  col {j}: {c(v)[:40]}")

print("\n=== PROCESOS (N° | Proceso | cols 10-22) ===")
last = 0
for r in rows[13:]:
    n = c(r[1])
    proc = c(r[2])
    if not n and not proc:
        continue
    if not n.isdigit():
        continue
    last = int(n)
    extra = [f"{j}:{c(r[j])[:24]}" for j in range(10, 23) if c(r[j])]
    print(f"  {n:>3} | {proc[:38]:38} | " + "  ".join(extra))
print(f"\nTotal de procesos: {last}")
wb.close()
