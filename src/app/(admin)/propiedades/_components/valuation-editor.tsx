"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatMXN, formatDate } from "@/app/_lib/format";
import { addValuation } from "@/app/_lib/valuation-actions";
import type { Valuation, Plusvalia } from "@/app/_lib/data/valuations";

const today = () => new Date().toISOString().slice(0, 10);

export function ValuationEditor({
  propertyId,
  valuations,
  plusvalia,
}: {
  propertyId: string;
  valuations: Valuation[];
  plusvalia: Plusvalia;
}) {
  const [value, setValue] = useState("");
  const [date, setDate] = useState(today());
  const [source, setSource] = useState("");
  const [pending, start] = useTransition();
  const router = useRouter();

  function save() {
    const v = parseFloat(value);
    if (!Number.isFinite(v) || v <= 0) {
      toast.error("Escribe un valor.");
      return;
    }
    start(async () => {
      const r = await addValuation(propertyId, { market_value: v, valued_on: date, source });
      if (r.error) toast.error(r.error);
      else {
        toast.success("Valuación guardada");
        setValue("");
        setSource("");
        router.refresh();
      }
    });
  }

  return (
    <div className="space-y-4">
      {plusvalia ? (
        <div className="flex flex-wrap gap-x-8 gap-y-3 text-sm">
          <div>
            <p className="text-muted-foreground text-xs">
              Valor inicial ({formatDate(plusvalia.first.valued_on)})
            </p>
            <p className="font-medium">{formatMXN(plusvalia.first.market_value)}</p>
          </div>
          <div>
            <p className="text-muted-foreground text-xs">
              Valor actual ({formatDate(plusvalia.latest.valued_on)})
            </p>
            <p className="font-medium">{formatMXN(plusvalia.latest.market_value)}</p>
          </div>
          <div>
            <p className="text-muted-foreground text-xs">Plusvalía</p>
            <p className={`font-bold ${plusvalia.plusvalia >= 0 ? "text-primary" : "text-destructive"}`}>
              {formatMXN(plusvalia.plusvalia)} ({Math.round(plusvalia.pct * 100)}%)
            </p>
          </div>
        </div>
      ) : (
        <p className="text-muted-foreground text-sm">
          Agrega al menos 2 valuaciones (en distintas fechas) para ver la plusvalía.
        </p>
      )}

      {valuations.length > 0 && (
        <div className="text-sm">
          {valuations.map((v) => (
            <div key={v.id} className="flex justify-between gap-3 border-b py-1.5">
              <span className="text-muted-foreground">
                {formatDate(v.valued_on)}
                {v.source ? ` · ${v.source}` : ""}
              </span>
              <span className="font-medium">{formatMXN(v.market_value)}</span>
            </div>
          ))}
        </div>
      )}

      <div className="bg-muted/30 flex flex-wrap items-end gap-3 rounded-lg border p-3">
        <div className="space-y-1.5">
          <Label htmlFor="val">Valor (MXN)</Label>
          <Input
            id="val"
            type="number"
            min={0}
            step="0.01"
            value={value}
            onChange={(e) => setValue(e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="vdate">Fecha</Label>
          <Input id="vdate" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="vsrc">Fuente</Label>
          <Input
            id="vsrc"
            value={source}
            onChange={(e) => setSource(e.target.value)}
            placeholder="avalúo, estimado…"
          />
        </div>
        <Button size="sm" onClick={save} disabled={pending}>
          {pending ? "Guardando…" : "Agregar valuación"}
        </Button>
      </div>
    </div>
  );
}
