# Extrae cuota (Mtto) + estacionamiento por oficina de la hoja INMUEBLES.
# Detecta encabezados de edificio (filas con texto en la 1a col y sin números).
import openpyxl

PATH = r"C:\Users\harro\Downloads\_docs_asistente\Administracion\METROS REDONDOS ADMÓN BASE.xlsx"
wb = openpyxl.load_workbook(PATH, read_only=True, data_only=True)
ws = wb["INMUEBLES"]

def num(v):
    return v if isinstance(v, (int, float)) else None

building = "?"
for i, row in enumerate(ws.iter_rows(values_only=True)):
    r = list(row)[:9]
    c0 = r[0]
    # Encabezado de edificio: texto en col0 y el resto vacío/no numérico
    if isinstance(c0, str) and c0.strip() and num(r[3]) is None and num(r[4]) is None:
        if c0.strip().upper() not in ("OFICINAS", "INMUEBLES"):
            building = c0.strip()
        continue
    of = c0
    precio, mtto, estac, total = num(r[4]), num(r[5]), num(r[6]), num(r[7])
    if of is not None and (mtto is not None or precio is not None):
        f = lambda x: f"{x:,.0f}" if x is not None else "—"
        print(f"{building[:14]:14} of {str(of)[:6]:6} precio {f(precio):>8}  mtto {f(mtto):>7}  estac {f(estac):>7}  total {f(total):>8}")
    if i > 90:
        break
