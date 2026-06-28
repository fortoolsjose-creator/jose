"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { setLeaseDates } from "../actions";

export function LeaseDatesEditor({
  leaseId,
  startDate,
  endDate,
  maintenanceFee,
  parkingFee,
  furnitureFee,
  garantiaMonto,
  polizaVigencia,
  pagareReferencia,
}: {
  leaseId: string;
  startDate: string | null;
  endDate: string | null;
  maintenanceFee: number;
  parkingFee: number;
  furnitureFee: number;
  garantiaMonto: number | null;
  polizaVigencia: string | null;
  pagareReferencia: string | null;
}) {
  const [start, setStart] = useState(startDate ?? "");
  const [end, setEnd] = useState(endDate ?? "");
  const [fee, setFee] = useState(String(maintenanceFee ?? 0));
  const [parking, setParking] = useState(String(parkingFee ?? 0));
  const [furniture, setFurniture] = useState(String(furnitureFee ?? 0));
  const [garantia, setGarantia] = useState(String(garantiaMonto ?? 0));
  const [poliza, setPoliza] = useState(polizaVigencia ?? "");
  const [pagare, setPagare] = useState(pagareReferencia ?? "");
  const [pending, startT] = useTransition();
  const router = useRouter();

  function save() {
    startT(async () => {
      const r = await setLeaseDates(leaseId, {
        start_date: start || null,
        end_date: end || null,
        maintenance_fee: parseFloat(fee) || 0,
        parking_fee: parseFloat(parking) || 0,
        furniture_fee: parseFloat(furniture) || 0,
        garantia_monto: parseFloat(garantia) || 0,
        poliza_vigencia: poliza || null,
        pagare_referencia: pagare || null,
      });
      if (r.error) toast.error(r.error);
      else {
        toast.success("Fechas guardadas");
        router.refresh();
      }
    });
  }

  return (
    <div className="flex flex-wrap items-end gap-3">
      <div className="space-y-1.5">
        <Label htmlFor="start">Inicio del contrato</Label>
        <Input
          id="start"
          type="date"
          value={start}
          onChange={(e) => setStart(e.target.value)}
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="end">Vigencia (fin)</Label>
        <Input id="end" type="date" value={end} onChange={(e) => setEnd(e.target.value)} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="mfee">Cuota de mantenimiento (mensual)</Label>
        <Input
          id="mfee"
          type="number"
          min={0}
          step="0.01"
          value={fee}
          onChange={(e) => setFee(e.target.value)}
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="pfee">Estacionamiento (mensual)</Label>
        <Input
          id="pfee"
          type="number"
          min={0}
          step="0.01"
          value={parking}
          onChange={(e) => setParking(e.target.value)}
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="ffee">Muebles (mensual)</Label>
        <Input
          id="ffee"
          type="number"
          min={0}
          step="0.01"
          value={furniture}
          onChange={(e) => setFurniture(e.target.value)}
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="garantia">Garantía (monto)</Label>
        <Input
          id="garantia"
          type="number"
          min={0}
          step="0.01"
          value={garantia}
          onChange={(e) => setGarantia(e.target.value)}
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="poliza">Vence la póliza/garantía</Label>
        <Input
          id="poliza"
          type="date"
          value={poliza}
          onChange={(e) => setPoliza(e.target.value)}
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="pagare">Referencia del pagaré</Label>
        <Input
          id="pagare"
          value={pagare}
          onChange={(e) => setPagare(e.target.value)}
          placeholder="No. / folio"
        />
      </div>
      <Button size="sm" variant="outline" onClick={save} disabled={pending}>
        {pending ? "Guardando…" : "Guardar fechas"}
      </Button>
    </div>
  );
}
