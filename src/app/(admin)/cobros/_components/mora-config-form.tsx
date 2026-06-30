"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { setMoraConfig } from "../actions";

export function MoraConfigForm({ tasa, gracia }: { tasa: number; gracia: number }) {
  const [t, setT] = useState(String(tasa));
  const [g, setG] = useState(String(gracia));
  const [pending, start] = useTransition();
  const router = useRouter();

  function save() {
    start(async () => {
      const res = await setMoraConfig({ mora_tasa_mensual: t, mora_dias_gracia: g });
      if (res.error) toast.error(res.error);
      else {
        toast.success("Cargo moratorio actualizado");
        router.refresh();
      }
    });
  }

  return (
    <div className="flex flex-wrap items-end gap-3 rounded-lg border p-3">
      <div className="space-y-1.5">
        <Label htmlFor="mt">Tasa moratoria (% mensual)</Label>
        <Input
          id="mt"
          type="number"
          step="0.1"
          min={0}
          value={t}
          onChange={(e) => setT(e.target.value)}
          className="w-32"
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="mg">Días de gracia</Label>
        <Input
          id="mg"
          type="number"
          min={0}
          value={g}
          onChange={(e) => setG(e.target.value)}
          className="w-28"
        />
      </div>
      <Button size="sm" variant="outline" onClick={save} disabled={pending}>
        {pending ? "Guardando…" : "Guardar"}
      </Button>
      <p className="text-muted-foreground w-full text-xs">
        Se cobra sobre el saldo vencido, después de los días de gracia. En 0% no se cobra mora.
      </p>
    </div>
  );
}
