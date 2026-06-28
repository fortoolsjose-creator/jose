"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check } from "lucide-react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { formatMXN } from "@/app/_lib/format";
import { setUnitMarket } from "../actions";
import type { MarketStudyRow } from "@/app/_lib/data/market-study";

function Row({ r }: { r: MarketStudyRow }) {
  const [min, setMin] = useState(r.min?.toString() ?? "");
  const [avg, setAvg] = useState(r.avg?.toString() ?? "");
  const [max, setMax] = useState(r.max?.toString() ?? "");
  const [pending, start] = useTransition();
  const router = useRouter();

  function save() {
    start(async () => {
      const res = await setUnitMarket(r.unitId, { min, avg, max });
      if (res?.error) toast.error(res.error);
      else {
        toast.success("Guardado");
        router.refresh();
      }
    });
  }

  return (
    <div className="grid grid-cols-12 items-center gap-2 px-3 py-2 text-sm">
      <span className="col-span-3 min-w-0 truncate font-medium">
        {r.property} · {r.label}
      </span>
      <span className="text-muted-foreground col-span-2 text-right">{formatMXN(r.current)}</span>
      <div className="col-span-2">
        <Input type="number" min={0} value={min} onChange={(e) => setMin(e.target.value)} className="h-8" placeholder="mín" />
      </div>
      <div className="col-span-2">
        <Input type="number" min={0} value={avg} onChange={(e) => setAvg(e.target.value)} className="h-8" placeholder="prom" />
      </div>
      <div className="col-span-2">
        <Input type="number" min={0} value={max} onChange={(e) => setMax(e.target.value)} className="h-8" placeholder="máx" />
      </div>
      <div className="col-span-1 text-right">
        <Button size="sm" variant="outline" onClick={save} disabled={pending} className="h-8 px-2">
          <Check className="size-4" />
        </Button>
      </div>
    </div>
  );
}

export function MarketStudyTable({ rows }: { rows: MarketStudyRow[] }) {
  return (
    <div className="divide-y rounded-lg border">
      <div className="text-muted-foreground grid grid-cols-12 gap-2 px-3 py-2 text-xs font-medium">
        <span className="col-span-3">Unidad</span>
        <span className="col-span-2 text-right">Renta actual</span>
        <span className="col-span-2">Mín</span>
        <span className="col-span-2">Prom</span>
        <span className="col-span-2">Máx</span>
        <span className="col-span-1" />
      </div>
      {rows.map((r) => (
        <Row key={r.unitId} r={r} />
      ))}
    </div>
  );
}
