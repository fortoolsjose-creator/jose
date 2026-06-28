# Nombres completos de los 39 procesos (para el checklist de cierre de mes).
import openpyxl, os, sys
sys.stdout.reconfigure(encoding="utf-8", errors="replace")
DL = r"C:\Users\harro\Downloads"
_m = [f for f in os.listdir(DL) if f.startswith("Procesos") and f.endswith(".xlsx")]
wb = openpyxl.load_workbook(os.path.join(DL, _m[0]), read_only=True, data_only=True)
ws = wb["PROCESOS"]
for r in ws.iter_rows(values_only=True):
    n = r[1]
    if isinstance(n, (int, float)) and str(int(n)).isdigit():
        proc = str(r[2] or "").replace("\n", " ").strip()
        freq = str(r[10] or "").strip()
        print(f"{int(n)}\t{freq}\t{proc}")
wb.close()
