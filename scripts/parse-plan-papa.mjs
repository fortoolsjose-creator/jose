import fs from "node:fs";
const SRC =
  "C:\\Users\\harro\\AppData\\Local\\Temp\\claude\\C--Users-harro\\160a1370-a87d-4a10-a6ea-c8aff7386a79\\tasks\\wfcjrquay.output";
const DEST = "C:\\Users\\harro\\Downloads\\Investigacion-Inquilino";
const parsed = JSON.parse(fs.readFileSync(SRC, "utf8"));
const r = parsed.result ?? parsed;
const fromFirstHeading = (s) => {
  if (typeof s !== "string") return "";
  const i = s.search(/^#\s/m);
  return i >= 0 ? s.slice(i) : s.trim();
};
const plan = fromFirstHeading(r.plan);
fs.mkdirSync(DEST, { recursive: true });
fs.writeFileSync(`${DEST}\\5-PLAN-feedback-papa.md`, plan, "utf8");
console.log("plan chars:", plan.length);
console.log("Escrito:", `${DEST}\\5-PLAN-feedback-papa.md`);
