"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Upload } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { importBankTransactions, type ParsedTx } from "../actions";

function normFecha(s: string | undefined): string | null {
  if (!s) return null;
  const t = s.trim();
  let m = t.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
  if (m) return `${m[1]}-${m[2].padStart(2, "0")}-${m[3].padStart(2, "0")}`;
  m = t.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{2,4})/);
  if (m) {
    const y = m[3].length === 2 ? `20${m[3]}` : m[3];
    return `${y}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
  }
  return null;
}

/** Parser tolerante: detecta delimitador y columnas por palabras clave del encabezado. */
function parseCsv(text: string): ParsedTx[] {
  const lines = text.trim().split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 2) return [];
  const first = lines[0];
  const delim =
    (first.match(/;/g)?.length ?? 0) > (first.match(/,/g)?.length ?? 0)
      ? ";"
      : first.includes("\t")
        ? "\t"
        : ",";
  const split = (l: string) => l.split(delim).map((c) => c.trim().replace(/^"|"$/g, ""));
  const header = split(lines[0]).map((h) => h.toLowerCase());
  const find = (keys: string[]) => header.findIndex((h) => keys.some((k) => h.includes(k)));
  const iFecha = find(["fecha", "date"]);
  const iAbono = find(["abono", "deposito", "depósito", "credito", "crédito", "ingreso"]);
  const iMonto = iAbono >= 0 ? iAbono : find(["monto", "importe", "amount", "cargo"]);
  const iRef = find(["referencia", "rastreo", "folio", "clave"]);
  const iConcepto = find(["concepto", "descripcion", "descripción", "movimiento", "detalle"]);

  const out: ParsedTx[] = [];
  for (let i = 1; i < lines.length; i++) {
    const c = split(lines[i]);
    let raw = (c[iMonto] ?? "").replace(/\$/g, "").replace(/\s/g, "");
    // Maneja separadores de miles/decimales en formato MX ("1,250.50") y LatAm/EU ("1.250,50").
    if (raw.includes(".") && raw.includes(",")) {
      raw =
        raw.lastIndexOf(",") > raw.lastIndexOf(".")
          ? raw.replace(/\./g, "").replace(",", ".")
          : raw.replace(/,/g, "");
    } else if (raw.includes(",")) {
      raw = /,\d{1,2}$/.test(raw) ? raw.replace(",", ".") : raw.replace(/,/g, "");
    }
    const monto = parseFloat(raw);
    if (!Number.isFinite(monto) || monto === 0) continue;
    out.push({
      fecha: normFecha(c[iFecha]),
      monto,
      referencia: iRef >= 0 ? c[iRef] || null : null,
      concepto: iConcepto >= 0 ? c[iConcepto] || null : null,
    });
  }
  // Dedup: re-pegar el mismo CSV no debe duplicar movimientos.
  const seen = new Set<string>();
  return out.filter((r) => {
    const k = JSON.stringify([r.fecha, r.monto, r.referencia, r.concepto]);
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

export function ImportBank() {
  const [text, setText] = useState("");
  const [preview, setPreview] = useState<ParsedTx[] | null>(null);
  const [pending, start] = useTransition();
  const router = useRouter();

  function analizar() {
    const rows = parseCsv(text);
    if (!rows.length) {
      toast.error("No se detectaron movimientos. Pega el CSV/Excel con encabezados (fecha, monto/abono…).");
      return;
    }
    setPreview(rows);
  }

  function importar() {
    if (!preview) return;
    start(async () => {
      const r = await importBankTransactions(preview);
      if (r.error) {
        toast.error(r.error);
        return;
      }
      toast.success(`${r.inserted} movimientos importados`);
      setText("");
      setPreview(null);
      router.refresh();
    });
  }

  return (
    <div className="space-y-3 rounded-lg border p-4">
      <p className="text-sm font-medium">Importar estado de cuenta</p>
      <p className="text-muted-foreground text-xs">
        Pega aquí el CSV o las filas (con encabezado) que exporta tu banco. Detecto las columnas de
        fecha, monto/abono, referencia y concepto automáticamente.
      </p>
      <Textarea
        rows={5}
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          setPreview(null);
        }}
        placeholder="fecha,abono,referencia,concepto&#10;15/06/2026,14020,202606123,COV202 renta"
        className="font-mono text-xs"
      />
      {preview ? (
        <div className="space-y-2">
          <p className="text-muted-foreground text-xs">
            {preview.length} movimientos detectados. Revisa y confirma:
          </p>
          <div className="max-h-40 overflow-y-auto rounded border text-xs">
            {preview.slice(0, 30).map((r, i) => (
              <div key={i} className="flex justify-between gap-2 border-b px-2 py-1 last:border-0">
                <span className="text-muted-foreground">{r.fecha ?? "—"}</span>
                <span className="truncate">{r.referencia ?? r.concepto ?? ""}</span>
                <span className="font-medium">${r.monto.toLocaleString("en-US")}</span>
              </div>
            ))}
          </div>
          <Button size="sm" disabled={pending} onClick={importar}>
            <Upload className="size-4" /> {pending ? "Importando…" : `Importar ${preview.length}`}
          </Button>
        </div>
      ) : (
        <Button size="sm" variant="outline" onClick={analizar} disabled={!text.trim()}>
          Analizar
        </Button>
      )}
    </div>
  );
}
