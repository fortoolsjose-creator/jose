# Vuelca la hoja PRECIOS MPM completa (precios de mercado mín/prom/máx por oficina).
import openpyxl

PATH = r"C:\Users\harro\Downloads\_docs_asistente\Administracion\METROS REDONDOS ADMÓN BASE.xlsx"
wb = openpyxl.load_workbook(PATH, read_only=True, data_only=True)
ws = wb["PRECIOS MPM"]

def c(v):
    if v is None:
        return ""
    if isinstance(v, float):
        return f"{v:,.0f}"
    return str(v).replace("\n", " ").strip()[:26]

for i, row in enumerate(ws.iter_rows(values_only=True)):
    vals = [c(x) for x in row[:9]]
    if any(vals):
        print(f"{i:>3} | " + " | ".join(vals))
    if i > 120:
        break
