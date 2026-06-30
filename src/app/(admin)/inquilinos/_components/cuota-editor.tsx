"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { setCuota } from "../actions";

export function CuotaEditor({
  leaseId,
  monto,
  desde,
}: {
  leaseId: string;
  monto: number;
  desde: string | null;
}) {
  const [m, setM] = useState(String(monto));
  const [d, setD] = useState(desde ?? "");
  const [pending, start] = useTransition();
  const router = useRouter();

  function save() {
    start(async () => {
      const res = await setCuota(leaseId, parseFloat(m) || 0, d || null);
      if (res.error) toast.error(res.error);
      else {
        toast.success("Cuota actualizada");
        router.refresh();
      }
    });
  }

  return (
    <div className="flex flex-wrap items-end gap-3">
      <div className="space-y-1.5">
        <Label htmlFor="cuota">Cuota mensual</Label>
        <Input
          id="cuota"
          type="number"
          min={0}
          step="1"
          value={m}
          onChange={(e) => setM(e.target.value)}
          className="w-36"
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="cdesde">Vigente desde</Label>
        <Input
          id="cdesde"
          type="date"
          value={d}
          onChange={(e) => setD(e.target.value)}
          className="w-44"
        />
      </div>
      <Button size="sm" variant="outline" onClick={save} disabled={pending}>
        {pending ? "Guardando…" : "Guardar cuota"}
      </Button>
    </div>
  );
}
