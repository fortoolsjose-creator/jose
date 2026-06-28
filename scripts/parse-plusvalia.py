# Extrae, por hoja/propiedad, el valor de compra y el precio de venta sugerido.
# Heurística: busca las etiquetas y toma el primer número de su fila. Solo lectura.
import openpyxl, unicodedata

PATH = r"C:\Users\harro\Downloads\INMUEBLES ANALISIS DE VENTA PRECIOS SUGERIDOS.xlsx"

def norm(s):
    return "".join(c for c in unicodedata.normalize("NFD", str(s)) if unicodedata.category(c) != "Mn").lower().strip()

def nums_after(cells, i):
    out = []
    for v in cells[i + 1:]:
        if isinstance(v, (int, float)):
            out.append(v)
    return out

wb = openpyxl.load_workbook(PATH, read_only=True, data_only=True)
print(f"{'HOJA':16} {'VALOR COMPRA':>14} {'PRECIO VENTA SUG':>17} {'PRECIO x M2':>12}")
print("-" * 64)
for ws in wb.worksheets:
    valor_compra = precio_venta = precio_m2 = None
    for row in ws.iter_rows(values_only=True):
        cells = list(row)
        for i, c in enumerate(cells):
            if not isinstance(c, str):
                continue
            n = norm(c)
            nx = nums_after(cells, i)
            if "valor de compra" in n and valor_compra is None and nx:
                valor_compra = nx[0]
            elif "precio de venta sugeri" in n and precio_venta is None and nx:
                precio_venta = nx[0]
            elif "precio x m2" in n and precio_m2 is None and nx:
                precio_m2 = nx[0]
    f = lambda x: f"{x:,.0f}" if isinstance(x, (int, float)) else "—"
    print(f"{ws.title:16} {f(valor_compra):>14} {f(precio_venta):>17} {f(precio_m2):>12}")
