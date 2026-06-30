import "server-only";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

export type ReceiptData = {
  folio: string;
  orgName: string;
  tenantName: string;
  unitLabel: string;
  propertyName: string;
  periodLabel: string; // e.g. "junio de 2026"
  amount: number;
  methodLabel: string;
  paidDateLabel: string; // e.g. "18 de junio de 2026"
  subtotal?: number;
  iva?: number;
  retencionIsr?: number;
};

const mxn = new Intl.NumberFormat("es-MX", {
  style: "currency",
  currency: "MXN",
});

/** A simple, non-fiscal "recibo de renta" PDF. */
export async function generateReceiptPdf(d: ReceiptData): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const page = pdf.addPage([595.28, 841.89]); // A4
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const { width, height } = page.getSize();

  const ink = rgb(0.06, 0.06, 0.06);
  const muted = rgb(0.45, 0.45, 0.45);
  const line = rgb(0.9, 0.9, 0.9);
  const margin = 56;
  let y = height - margin;

  const draw = (
    text: string,
    x: number,
    yy: number,
    f = font,
    size = 11,
    color = ink,
  ) => page.drawText(text, { x, y: yy, font: f, size, color });

  draw(d.orgName, margin, y, bold, 18);
  draw("Recibo de renta", width - margin - 150, y, font, 12, muted);
  y -= 14;
  draw(`Folio: ${d.folio}`, width - margin - 150, y, font, 9, muted);

  y -= 28;
  page.drawLine({ start: { x: margin, y }, end: { x: width - margin, y }, thickness: 1, color: line });
  y -= 30;

  const row = (label: string, value: string) => {
    draw(label, margin, y, font, 10, muted);
    draw(value, margin + 150, y, bold, 11);
    y -= 24;
  };
  row("Arrendatario", d.tenantName);
  row("Unidad", [d.propertyName, d.unitLabel].filter(Boolean).join(" - "));
  row("Periodo", d.periodLabel);
  row("Metodo de pago", d.methodLabel);
  row("Fecha de pago", d.paidDateLabel);

  y -= 6;
  page.drawLine({ start: { x: margin, y }, end: { x: width - margin, y }, thickness: 1, color: line });
  y -= 32;
  draw("Total pagado", margin, y, bold, 13);
  draw(mxn.format(d.amount), width - margin - 130, y, bold, 16);

  y -= 54;
  draw(
    "Este recibo confirma el pago de la renta del periodo indicado.",
    margin,
    y,
    font,
    9,
    muted,
  );
  y -= 14;
  draw("Documento sin validez fiscal (no es CFDI).", margin, y, font, 9, muted);

  return pdf.save();
}
