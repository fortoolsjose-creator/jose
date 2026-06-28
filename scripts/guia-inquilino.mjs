// Genera la guía visual en PDF para inquilinos (QR + link + cómo entrar y usar).
// Correr: node scripts/guia-inquilino.mjs   (desde C:\Users\harro\llave)
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import QRCode from "qrcode";
import fs from "node:fs";

const URL = "https://metrosredondos.vercel.app";
const OUT = "C:\\Users\\harro\\Downloads\\Guia-Inquilino-Metros-Redondos.pdf";
const TEL = "55 2086 4155"; // contacto (cámbialo si tus papás usan otro)

const orange = rgb(0.878, 0.4, 0.012);
const slate = rgb(0.271, 0.353, 0.392);
const ink = rgb(0.16, 0.18, 0.2);
const soft = rgb(0.42, 0.45, 0.48);
const panel = rgb(0.965, 0.965, 0.965);
const white = rgb(1, 1, 1);

const pdf = await PDFDocument.create();
const F = await pdf.embedFont(StandardFonts.Helvetica);
const B = await pdf.embedFont(StandardFonts.HelveticaBold);

const qrBuf = await QRCode.toBuffer(URL, {
  width: 560, margin: 1, errorCorrectionLevel: "M",
  color: { dark: "#455A64FF", light: "#FFFFFFFF" },
});
const qr = await pdf.embedPng(qrBuf);

const W = 612, H = 792, M = 50;

function wrap(text, font, size, maxW) {
  const words = text.split(" ");
  const lines = [];
  let line = "";
  for (const w of words) {
    const t = line ? line + " " + w : w;
    if (font.widthOfTextAtSize(t, size) > maxW && line) { lines.push(line); line = w; }
    else line = t;
  }
  if (line) lines.push(line);
  return lines;
}
function para(page, text, { x, y, size = 11, font = F, color = ink, maxW, lh = 1.45 }) {
  for (const ln of wrap(text, font, size, maxW)) {
    page.drawText(ln, { x, y, size, font, color });
    y -= size * lh;
  }
  return y;
}
function wordmark(page, x, y, size) {
  const mW = B.widthOfTextAtSize("metros", size);
  page.drawText("metros", { x, y, size, font: B, color: slate });
  page.drawText("redondos", { x: x + mW, y, size, font: B, color: orange });
}
function step(page, n, title, y) {
  const cx = M + 11;
  page.drawCircle({ x: cx, y: y + 4, size: 11, color: orange });
  const nW = B.widthOfTextAtSize(String(n), 13);
  page.drawText(String(n), { x: cx - nW / 2, y, size: 13, font: B, color: white });
  page.drawText(title, { x: cx + 22, y, size: 15, font: B, color: slate });
  return y - 24;
}
function bullet(page, text, y, { x = M + 14, maxW = W - 2 * M - 14 } = {}) {
  page.drawCircle({ x: x - 6, y: y + 3.5, size: 1.8, color: orange });
  return para(page, text, { x, y, size: 10.5, maxW, color: ink });
}

// ---------- PÁGINA 1 ----------
let p = pdf.addPage([W, H]);
wordmark(p, M, H - 64, 30);
p.drawRectangle({ x: M, y: H - 78, width: W - 2 * M, height: 2.5, color: orange });
let y = H - 110;
p.drawText("Guía rápida para inquilinos", { x: M, y, size: 23, font: B, color: slate });
y -= 22;
y = para(p, "Tu portal en línea: paga tu renta, descarga recibos y reporta reparaciones, todo desde tu celular.", { x: M, y, size: 12, font: F, color: soft, maxW: W - 2 * M });

// Paso 1 — Entrar (con QR)
y -= 18;
y = step(p, 1, "Entra al portal", y);
const qrSize = 150;
const qrX = W - M - qrSize, qrY = y - qrSize + 6;
p.drawRectangle({ x: qrX - 12, y: qrY - 26, width: qrSize + 24, height: qrSize + 38, color: panel });
p.drawImage(qr, { x: qrX, y: qrY, width: qrSize, height: qrSize });
const cap = "Apunta tu cámara aquí";
p.drawText(cap, { x: qrX + (qrSize - F.widthOfTextAtSize(cap, 9)) / 2, y: qrY - 17, size: 9, font: F, color: soft });
const leftW = qrX - 12 - M - 16;
let ly = y - 4;
ly = para(p, "Escanea el código QR con la cámara de tu celular. O escribe esta dirección en tu navegador:", { x: M, y: ly, size: 11, maxW: leftW });
ly -= 8;
p.drawRectangle({ x: M, y: ly - 6, width: leftW, height: 26, color: white, borderColor: orange, borderWidth: 1.2 });
p.drawText(URL, { x: M + 10, y: ly + 2, size: 12, font: B, color: orange });
y = qrY - 34;

// Paso 2 — Iniciar sesión
y = step(p, 2, "Inicia sesión", y);
y = para(p, "Tu arrendador te enviará tu acceso por WhatsApp o correo. Puede ser de dos formas:", { x: M, y, size: 11, maxW: W - 2 * M });
y -= 6;
y = bullet(p, "Un enlace mágico: tócalo y entras directo, sin escribir contraseña.", y);
y -= 3;
y = bullet(p, "O tu correo electrónico + una contraseña temporal. La primera vez puedes cambiarla por una tuya.", y);
y -= 3;
y = bullet(p, "Tu usuario siempre es tu correo electrónico.", y);

// Paso 3 — Instalar
y -= 14;
y = step(p, 3, "Instálala en tu celular (opcional)", y);
y = para(p, "Para que quede como una app, sin descargar nada de ninguna tienda:", { x: M, y, size: 11, maxW: W - 2 * M });
y -= 6;
y = bullet(p, "iPhone (Safari): toca el botón Compartir y luego 'Agregar a inicio'.", y);
y -= 3;
y = bullet(p, "Android (Chrome): toca el menú de tres puntos y luego 'Agregar a pantalla principal'.", y);

// pie pág 1
p.drawText("metrosredondos.vercel.app", { x: M, y: 40, size: 9, font: F, color: soft });
p.drawText("1 / 2", { x: W - M - F.widthOfTextAtSize("1 / 2", 9), y: 40, size: 9, font: F, color: soft });

// ---------- PÁGINA 2 ----------
p = pdf.addPage([W, H]);
wordmark(p, M, H - 64, 24);
p.drawRectangle({ x: M, y: H - 76, width: W - 2 * M, height: 2.5, color: orange });
y = H - 108;
p.drawText("¿Qué puedes hacer?", { x: M, y, size: 21, font: B, color: slate });
y -= 30;

const feats = [
  ["Ver y pagar tu renta", "Consulta cuánto debes y tu próximo vencimiento. Cuando pagues, avísalo con un toque desde 'Mi renta'."],
  ["Descargar tus recibos", "Guarda en tu celular el comprobante de cada pago confirmado."],
  ["Reportar una reparación", "Manda un reporte con foto y sigue su avance paso a paso (Recibido, En proceso, Resuelto)."],
  ["Ver tu contrato", "Tu renta, depósito, día de pago y los datos del inmueble, siempre a la mano."],
];
let n = 1;
for (const [t, d] of feats) {
  p.drawCircle({ x: M + 11, y: y + 4, size: 11, color: orange });
  const nW = B.widthOfTextAtSize(String(n), 13);
  p.drawText(String(n), { x: M + 11 - nW / 2, y, size: 13, font: B, color: white });
  p.drawText(t, { x: M + 34, y, size: 14, font: B, color: ink });
  y -= 18;
  y = para(p, d, { x: M + 34, y, size: 11, maxW: W - 2 * M - 34, color: soft });
  y -= 16;
  n++;
}

// Ayuda
y -= 6;
const boxH = 92;
p.drawRectangle({ x: M, y: y - boxH, width: W - 2 * M, height: boxH, color: panel });
p.drawRectangle({ x: M, y: y - boxH, width: 4, height: boxH, color: orange });
let hy = y - 22;
p.drawText("¿Necesitas ayuda?", { x: M + 18, y: hy, size: 14, font: B, color: slate });
hy -= 20;
hy = para(p, `Escríbele a tu arrendador (Metros Redondos) por WhatsApp al ${TEL}, o responde el correo de bienvenida que recibiste.`, { x: M + 18, y: hy, size: 11, maxW: W - 2 * M - 36, color: ink });
hy -= 4;
para(p, "Tus datos están protegidos: solo tú y tu arrendador ven tus pagos y reportes.", { x: M + 18, y: hy, size: 10, maxW: W - 2 * M - 36, color: soft });

p.drawText("metrosredondos.vercel.app", { x: M, y: 40, size: 9, font: F, color: soft });
p.drawText("2 / 2", { x: W - M - F.widthOfTextAtSize("2 / 2", 9), y: 40, size: 9, font: F, color: soft });

const bytes = await pdf.save();
fs.writeFileSync(OUT, bytes);
console.log("PDF creado:", OUT, `(${Math.round(bytes.length / 1024)} KB, ${pdf.getPageCount()} páginas)`);
