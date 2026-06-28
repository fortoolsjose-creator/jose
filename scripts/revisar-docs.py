import os, sys, re, zipfile
sys.stdout.reconfigure(encoding="utf-8", errors="replace")
DL = r"C:\Users\harro\Downloads"

def find(prefix, ext):
    for f in os.listdir(DL):
        if f.startswith(prefix) and f.lower().endswith(ext):
            return os.path.join(DL, f)
    return None

def read_pdf(path):
    try:
        from pypdf import PdfReader
        r = PdfReader(path)
        return "\n".join((pg.extract_text() or "") for pg in r.pages)
    except Exception as e1:
        try:
            import pdfplumber
            with pdfplumber.open(path) as pdf:
                return "\n".join((pg.extract_text() or "") for pg in pdf.pages)
        except Exception as e2:
            return f"(sin librería PDF: {e1} / {e2})"

def read_docx(path):
    z = zipfile.ZipFile(path)
    xml = z.read("word/document.xml").decode("utf-8", "replace")
    xml = xml.replace("</w:p>", "\n").replace("</w:tr>", "\n")
    return re.sub(r"<[^>]+>", "", xml)

for name, prefix, ext, fn in [
    ("MANUAL DE PROCEDIMIENTOS", "Manual de procedimientos", ".pdf", read_pdf),
    ("ACUSE DE ENTREGA DE RENTAS", "ACUSE DE ENTREGA", ".pdf", read_pdf),
    ("ACUSE DE COBRO RENTAS", "ACUSE DE COBRO", ".docx", read_docx),
]:
    p = find(prefix, ext)
    print("\n" + "=" * 90 + f"\n{name}  ›  {os.path.basename(p) if p else 'NO ENCONTRADO'}\n" + "=" * 90)
    if p:
        try:
            t = fn(p).strip()
            print(t[:7000] if t else "(vacío / sin texto extraíble — posible escaneo)")
        except Exception as e:
            print("ERROR:", e)
