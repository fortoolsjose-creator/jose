import fs from "node:fs";

const SRC =
  "C:\\Users\\harro\\AppData\\Local\\Temp\\claude\\C--Users-harro\\160a1370-a87d-4a10-a6ea-c8aff7386a79\\tasks\\ws4q1djqh.output";
const DEST = "C:\\Users\\harro\\Downloads\\Investigacion-Inquilino";

const raw = fs.readFileSync(SRC, "utf8");
const parsed = JSON.parse(raw);
const r = parsed.result ?? parsed;

// Quita el "preámbulo" del agente: empieza desde el primer encabezado markdown.
const fromFirstHeading = (s) => {
  if (typeof s !== "string") return "";
  const i = s.search(/^#\s/m);
  return i >= 0 ? s.slice(i) : s.trim();
};

const analysis = fromFirstHeading(r.analysis);
const features = fromFirstHeading(r.features);
const biblio = r.bibliography ?? [];
const rejected = r.rejected ?? [];
const stats = r.stats ?? {};

fs.mkdirSync(DEST, { recursive: true });

const bibMd =
  "# Bibliografía verificada (APA 7)\n\n" +
  `Fuentes confirmadas como reales y citables: **${biblio.length}**.\n\n` +
  biblio
    .map((b, i) => {
      const link = b.doi ? `https://doi.org/${String(b.doi).replace(/^https?:\/\/doi\.org\//, "")}` : b.url || "";
      const pr = b.peerReviewed ? " *(peer-reviewed)*" : "";
      return `${i + 1}. ${b.cita}${pr}${link ? `\n   ${link}` : ""}`;
    })
    .join("\n\n");

fs.writeFileSync(`${DEST}\\1-analisis-comportamiento-inquilino.md`, analysis, "utf8");
fs.writeFileSync(`${DEST}\\2-funciones-recomendadas.md`, features, "utf8");
fs.writeFileSync(`${DEST}\\3-bibliografia.md`, bibMd, "utf8");

const combined =
  `# Comportamiento del inquilino — investigación con base académica\n\n` +
  `*Dimensiones investigadas: ${stats.dimensions} · Fuentes candidatas: ${stats.candidateSources} · Únicas: ${stats.uniqueSources} · Verificadas y citables: ${stats.citableSources}*\n\n---\n\n` +
  analysis +
  "\n\n---\n\n" +
  features +
  "\n\n---\n\n" +
  bibMd +
  (rejected.length
    ? "\n\n---\n\n## Fuentes descartadas en la verificación (NO citar)\n\n" +
      rejected.map((x) => `- ${x.title} — ${x.notes}`).join("\n")
    : "");
fs.writeFileSync(`${DEST}\\Comportamiento-Inquilino-COMPLETO.md`, combined, "utf8");

// Resumen a consola
console.log("Stats:", JSON.stringify(stats));
console.log("Bibliografía verificada:", biblio.length, "| Descartadas:", rejected.length);
console.log("analysis chars:", analysis.length, "| features chars:", features.length);
console.log("Archivos escritos en:", DEST);
for (const f of fs.readdirSync(DEST)) {
  const st = fs.statSync(`${DEST}\\${f}`);
  console.log("  -", f, `(${Math.round(st.size / 1024)} KB)`);
}
