// Genera una mini guía en PDF para Magaly (presentación de la plataforma).
// Correr desde C:\Users\harro\llave:  node scripts/guia-magaly.mjs
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { writeFileSync } from "fs";

const doc = await PDFDocument.create();
const font = await doc.embedFont(StandardFonts.Helvetica);
const bold = await doc.embedFont(StandardFonts.HelveticaBold);

const orange = rgb(0.878, 0.4, 0.012);
const dark = rgb(0.13, 0.13, 0.13);
const gray = rgb(0.42, 0.42, 0.42);

const W = 612, H = 792, M = 56, maxW = W - M * 2;
let page = doc.addPage([W, H]);
let y = H - M;

function nl(size) {
  if (y < M + size + 20) {
    page = doc.addPage([W, H]);
    y = H - M;
  }
}
function wrap(s, f, size, width) {
  const lines = [];
  for (const para of String(s).split("\n")) {
    const words = para.split(/\s+/);
    let cur = "";
    for (const w of words) {
      const test = cur ? cur + " " + w : w;
      if (f.widthOfTextAtSize(test, size) > width && cur) {
        lines.push(cur);
        cur = w;
      } else cur = test;
    }
    lines.push(cur);
  }
  return lines;
}
function text(s, { size = 11, f = font, color = dark, gap = 5, indent = 0 } = {}) {
  for (const ln of wrap(s, f, size, maxW - indent)) {
    nl(size);
    page.drawText(ln, { x: M + indent, y: y - size, size, font: f, color });
    y -= size + gap;
  }
}
function heading(s) {
  y -= 12;
  text(s, { size: 14, f: bold, color: orange, gap: 7 });
}
function bullet(s) {
  const size = 11;
  const lines = wrap(s, font, size, maxW - 18);
  nl(size);
  page.drawText("•", { x: M + 2, y: y - size, size, font: bold, color: orange });
  lines.forEach((ln, i) => {
    nl(size);
    page.drawText(ln, { x: M + 16, y: y - size, size, font, color: dark });
    y -= size + 4;
  });
  y -= 2;
}

page.drawText("Metros Redondos", { x: M, y: y - 13, size: 13, font: bold, color: gray });
y -= 30;
page.drawText("Plataforma de administración", { x: M, y: y - 22, size: 22, font: bold, color: dark });
y -= 32;
page.drawText("Guía rápida para empezar", { x: M, y: y - 13, size: 13, font, color: orange });
y -= 30;

text(
  "Hola Magaly. Esta plataforma es una herramienta para ayudarte en tu trabajo de cada día. Junta todo en un solo lugar: rentas, cuotas, gastos, mantenimiento y reportes. Así ya no tienes que ir y venir entre tantos archivos de Excel.",
);
text(
  "La plataforma no hace tu trabajo por ti. Tú la manejas. Lo que hace es ahorrarte tiempo y ayudarte a tener todo en orden, para que no se te pase nada. Tú sigues siendo quien sabe cómo funciona cada cosa.",
);
text(
  "Está hecha pensando en tu forma de trabajar. Si puedes, dale un vistazo con calma. Mañana la vemos juntos y la ajustamos a lo que necesites.",
);

heading("Cómo entrar");
text("Entra desde tu celular o tu computadora a esta página:");
text("metrosredondos.vercel.app", { f: bold, color: orange });
text("Usuario:  ana@propiedadesgarcia.mx");
text("Contraseña:  Llave1234!");
text("(Más adelante puedes cambiar la contraseña o tener tu propio usuario.)", { size: 10, color: gray });

heading("Lo primero que ves: Inicio");
text("Cuando entras, ves un resumen del mes, todo junto:");
bullet("Cuánto dinero ha entrado y cuánto falta por cobrar.");
bullet("Quién debe.");
bullet("Qué necesita tu atención. Por ejemplo: contratos que están por terminar, o pagos atrasados.");

heading("El menú empieza sencillo");
text(
  "El menú empieza sencillo, con lo más importante. Si quieres ver todas las herramientas, abajo hay un botón que dice “Mostrar todo”. Al apretarlo aparecen todas: Cobros, Cuotas, Gastos, Mantenimiento, Cierre de mes, Nómina, Proveedores y Reportes.",
);

heading("Dónde está cada cosa");
bullet("Cobrar rentas y llenar acuses  ›  Cobros");
bullet("Cuotas de mantenimiento  ›  Cuotas");
bullet("Gastos y pagos (con o sin factura)  ›  Gastos");
bullet("Arreglos y revisiones de los edificios  ›  Mantenimiento");
bullet("El fondo de mantenimiento y el de operación  ›  Cuotas y Reportes");
bullet("Los precios de mercado  ›  Estudio de mercado");
bullet("Tus tareas del mes (tus 39 pasos)  ›  Cierre de mes (una lista para ir palomeando)");
bullet("El personal y sus pagos  ›  Nómina");
bullet("Los proveedores  ›  Proveedores");
bullet("Los números del negocio: quién debe, quién paga a tiempo, cuánto deja cada edificio  ›  Reportes");

heading("Antes de la llamada, ve 3 cosas");
text("No tienes que aprenderte nada. Solo échale un ojo y piensa qué te serviría.");
bullet("El Inicio y los Reportes. ¿Los números te hacen sentido?");
bullet("Cierre de mes. Ahí están tus 39 tareas en una lista. ¿Falta alguna? ¿Quedaron bien acomodadas?");
bullet("La sección que más uses. ¿Qué le falta para que de verdad te sirva?");

heading("Vas a ver algunas secciones vacías, y está bien");
text(
  "Algunas partes están vacías a propósito. Dependen de tu información, y no quisimos poner números inventados:",
);
bullet("El fondo de operación y los montos de la nómina: esperan tus archivos.");
bullet("El formato del recibo de renta: queremos que salga igual al tuyo.");
text("Eso lo llenamos juntos mañana. Por eso te pedimos esos archivos.", { size: 10, color: gray });

heading("La llamada de mañana");
text(
  "La llamada es para que tú me enseñes cómo trabajas, y ajustar la plataforma a tu manera. Tú la conoces mejor que nadie. Mientras más me corrijas, mejor te va a quedar.",
);

const bytes = await doc.save();
const out = "C:\\Users\\harro\\Downloads\\Guia-Plataforma-Metros-Redondos.pdf";
writeFileSync(out, bytes);
console.log("PDF generado:", out, `(${doc.getPageCount()} páginas)`);
