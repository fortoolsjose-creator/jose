"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { setTenantFiscal } from "../actions";

export function FiscalForm({
  profileId,
  rfc,
  razonSocial,
  regimenFiscal,
  usoCfdi,
  requiereFactura,
}: {
  profileId: string;
  rfc: string | null;
  razonSocial: string | null;
  regimenFiscal: string | null;
  usoCfdi: string | null;
  requiereFactura: boolean;
}) {
  const [req, setReq] = useState(requiereFactura);
  const [rfcv, setRfc] = useState(rfc ?? "");
  const [razon, setRazon] = useState(razonSocial ?? "");
  const [regimen, setRegimen] = useState(regimenFiscal ?? "");
  const [uso, setUso] = useState(usoCfdi ?? "");
  const [pending, start] = useTransition();
  const router = useRouter();

  function save() {
    start(async () => {
      const r = await setTenantFiscal(profileId, {
        rfc: rfcv,
        razon_social: razon,
        regimen_fiscal: regimen,
        uso_cfdi: uso,
        requiere_factura: req,
      });
      if (r.error) toast.error(r.error);
      else {
        toast.success("Datos fiscales guardados");
        router.refresh();
      }
    });
  }

  return (
    <div className="space-y-3">
      <label className="flex cursor-pointer items-center gap-2 text-sm">
        <input
          type="checkbox"
          className="accent-primary size-4"
          checked={req}
          onChange={(e) => setReq(e.target.checked)}
        />
        Este inquilino <span className="font-medium">requiere factura</span>
      </label>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="rfc">RFC</Label>
          <Input id="rfc" value={rfcv} onChange={(e) => setRfc(e.target.value)} placeholder="XAXX010101000" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="razon">Razón social</Label>
          <Input id="razon" value={razon} onChange={(e) => setRazon(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="regimen">Régimen fiscal</Label>
          <Input id="regimen" value={regimen} onChange={(e) => setRegimen(e.target.value)} placeholder="612, 601…" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="uso">Uso de CFDI</Label>
          <Input id="uso" value={uso} onChange={(e) => setUso(e.target.value)} placeholder="G03, P01…" />
        </div>
      </div>
      <Button size="sm" variant="outline" onClick={save} disabled={pending}>
        {pending ? "Guardando…" : "Guardar datos fiscales"}
      </Button>
    </div>
  );
}
