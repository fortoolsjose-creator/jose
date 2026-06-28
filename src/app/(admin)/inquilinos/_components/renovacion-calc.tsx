"use client";

import { useState, useTransition } from "react";
import { FileText } from "lucide-react";
import { toast } from "sonner";
import { inpcAcumulado, calcRenovacion, latestInpcYm } from "@/app/_lib/inpc";
import { formatMXN, formatMonth } from "@/app/_lib/format";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { generarCartaRenovacion } from "../actions";

const selectClass =
  "flex h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50";
const m2peso = (v: number) => `$${Math.round(v).toLocaleString("es-MX")}/m²`;

export function RenovacionCalc({
  leaseId,
  renta,
  cuota,
  desdeDefault,
  m2,
  marketAvg,
}: {
  leaseId: string;
  renta: number;
  cuota: number;
  desdeDefault: string;
  m2?: number | null;
  marketAvg?: number | null;
}) {
  const [desde, setDesde] = useState(desdeDefault);
  const [margen, setMargen] = useState("2.5");
  const [objetivoM2, setObjetivoM2] = useState("");
  const [pending, start] = useTransition();

  function generarCarta() {
    start(async () => {
      const res = await generarCartaRenovacion(leaseId, desde, parseFloat(margen) || 0);
      if (res.error || !res.pdf) {
        toast.error(res.error ?? "No se pudo generar la carta.");
        return;
      }
      const bytes = Uint8Array.from(atob(res.pdf), (c) => c.charCodeAt(0));
      const url = URL.createObjectURL(new Blob([bytes], { type: "application/pdf" }));
      const a = document.createElement("a");
      a.href = url;
      a.download = res.filename ?? "carta-renovacion.pdf";
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    });
  }

  const margenNum = parseFloat(margen) || 0;
  const inpc = desde ? inpcAcumulado(desde) : 0;
  const r = calcRenovacion(renta, cuota, inpc, margenNum);

  const proy: { año: number; renta: number; cuota: number; total: number }[] = [];
  let rr = renta;
  let cc = cuota;
  for (let i = 1; i <= 5; i++) {
    rr = Math.round(rr * (1 + r.aumentoPct / 100));
    cc = Math.round(cc * (1 + r.aumentoPct / 100));
    proy.push({ año: i, renta: rr, cuota: cc, total: rr + cc });
  }

  const tieneM2 = !!m2 && m2 > 0;
  const objNum = parseFloat(objetivoM2) || 0;
  const rentaObjetivo = tieneM2 && objNum > 0 ? Math.round(objNum * (m2 as number)) : 0;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-end gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="desde">Desde (última renovación o inicio)</Label>
          <Input
            id="desde"
            type="month"
            value={desde}
            max={latestInpcYm()}
            onChange={(e) => setDesde(e.target.value)}
            className="w-40"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="margen">Margen sobre INPC</Label>
          <select id="margen" className={`${selectClass} w-28`} value={margen} onChange={(e) => setMargen(e.target.value)}>
            <option value="2.5">+ 2.5%</option>
            <option value="1.5">+ 1.5%</option>
            <option value="1">+ 1%</option>
            <option value="0">Solo INPC</option>
          </select>
        </div>
      </div>

      <div className="bg-muted/50 rounded-lg p-3 text-sm">
        <p className="text-muted-foreground">
          INPC acumulado <span className="text-foreground font-medium">{inpc.toFixed(2)}%</span> + margen{" "}
          {margenNum}% = aumento <span className="text-primary font-bold">{r.aumentoPct.toFixed(2)}%</span>
          <span className="text-muted-foreground"> · INPC hasta {formatMonth(latestInpcYm() + "-01")}</span>
        </p>
        <div className="mt-2 grid grid-cols-3 gap-2">
          <div>
            <p className="text-muted-foreground text-xs">Renta</p>
            <p className="font-medium">{formatMXN(renta)} → {formatMXN(r.nuevaRenta)}</p>
          </div>
          <div>
            <p className="text-muted-foreground text-xs">Cuota</p>
            <p className="font-medium">{formatMXN(cuota)} → {formatMXN(r.nuevaCuota)}</p>
          </div>
          <div>
            <p className="text-muted-foreground text-xs">Total / mes</p>
            <p className="font-bold">{formatMXN(renta + cuota)} → {formatMXN(r.nuevoTotal)}</p>
          </div>
        </div>
        {tieneM2 && (
          <p className="text-muted-foreground mt-2 border-t pt-2 text-xs">
            {(m2 as number).toLocaleString("es-MX")} m² · Costo por m²:{" "}
            <span className="text-foreground font-medium">{m2peso(renta / (m2 as number))}</span> →{" "}
            <span className="text-foreground font-medium">{m2peso(r.nuevaRenta / (m2 as number))}</span>
            {marketAvg && marketAvg > 0 && (
              <>
                {" · mercado ≈ "}
                <span className="text-foreground font-medium">{m2peso(marketAvg / (m2 as number))}</span>
              </>
            )}
          </p>
        )}
      </div>

      {tieneM2 && (
        <div className="flex flex-wrap items-end gap-3 rounded-lg border p-3">
          <div className="space-y-1.5">
            <Label htmlFor="objm2">Precio objetivo por m² (opcional)</Label>
            <Input
              id="objm2"
              type="number"
              min={0}
              value={objetivoM2}
              onChange={(e) => setObjetivoM2(e.target.value)}
              placeholder="ej. 700"
              className="w-36"
            />
          </div>
          {rentaObjetivo > 0 && (
            <p className="text-sm">
              A {m2peso(objNum)} → renta <span className="font-bold">{formatMXN(rentaObjetivo)}</span>
              <span className="text-muted-foreground"> (vs {formatMXN(renta)} actual)</span>
            </p>
          )}
        </div>
      )}

      <div>
        <p className="text-muted-foreground mb-1 text-xs font-medium">
          Proyección a 5 años (si el aumento se mantiene en {r.aumentoPct.toFixed(2)}%/año)
        </p>
        <div className="divide-y rounded-lg border text-sm">
          <div className="text-muted-foreground grid grid-cols-4 gap-2 px-3 py-1.5 text-xs font-medium">
            <span>Año</span>
            <span className="text-right">Renta</span>
            <span className="text-right">Cuota</span>
            <span className="text-right">Total</span>
          </div>
          {proy.map((p) => (
            <div key={p.año} className="grid grid-cols-4 gap-2 px-3 py-1.5">
              <span>Año {p.año}</span>
              <span className="text-right">{formatMXN(p.renta)}</span>
              <span className="text-muted-foreground text-right">{formatMXN(p.cuota)}</span>
              <span className="text-right font-medium">{formatMXN(p.total)}</span>
            </div>
          ))}
        </div>
      </div>

      <Button size="sm" variant="outline" onClick={generarCarta} disabled={pending}>
        <FileText className="size-4" /> {pending ? "Generando…" : "Generar carta propuesta (PDF)"}
      </Button>

      <p className="text-muted-foreground text-xs">
        Cálculo con el INPC de Banxico (igual que tu calculadora). Ajusta el mes de “desde” a la
        última renovación de este contrato.
      </p>
    </div>
  );
}
