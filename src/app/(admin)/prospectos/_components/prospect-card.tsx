"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { KeyRound, Link as LinkIcon, Trash2, UserCheck, UserPlus } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatMXN } from "@/app/_lib/format";
import { scoreProspect, RIESGO_DOT } from "@/app/_lib/prospect-score";
import { PROSPECT_STAGE_LABELS, type ProspectStage } from "@/app/_lib/types";
import type { ProspectRow } from "@/app/_lib/data/prospects";
import {
  setProspectStage,
  setProspectPapeleo,
  deleteProspect,
  convertProspectToTenant,
} from "../actions";

const selectClass =
  "flex h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50";
const STAGES: ProspectStage[] = ["prospecto", "evaluacion", "aprobado", "rechazado", "papeleo", "cliente"];
const PAPELEO = [
  { key: "contrato_ok", label: "Contrato" },
  { key: "pagare_ok", label: "Pagaré" },
  { key: "garantia_ok", label: "Garantía" },
  { key: "acta_ok", label: "Acta" },
] as const;

export function ProspectCard({ p }: { p: ProspectRow }) {
  const [pending, start] = useTransition();
  const [creds, setCreds] = useState<{
    email: string;
    password?: string;
    inviteLink?: string;
  } | null>(null);
  const router = useRouter();
  const r = scoreProspect(p.monthly_income, p.rent_target, p.guarantee_type);

  const convert = () =>
    start(async () => {
      const res = await convertProspectToTenant(p.id);
      if (res.error) {
        toast.error(res.error);
        return;
      }
      router.refresh();
      if (res.tempPassword || res.inviteLink) {
        setCreds({
          email: res.tenantEmail ?? "",
          password: res.tempPassword,
          inviteLink: res.inviteLink,
        });
      } else {
        toast.success("Convertido. Activa el contrato en Arrendatarios.");
      }
    });

  const move = (stage: ProspectStage) =>
    start(async () => {
      const res = await setProspectStage(p.id, stage);
      if (res.error) toast.error(res.error);
      else router.refresh();
    });
  const togglePapeleo = (field: (typeof PAPELEO)[number]["key"], value: boolean) =>
    start(async () => {
      const res = await setProspectPapeleo(p.id, field, value);
      if (res.error) toast.error(res.error);
      else router.refresh();
    });
  const del = () =>
    start(async () => {
      const res = await deleteProspect(p.id);
      if (res.error) toast.error(res.error);
      else {
        toast.success("Eliminado");
        router.refresh();
      }
    });

  return (
    <Card>
      <CardContent className="space-y-2 py-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className={`size-2.5 shrink-0 rounded-full ${RIESGO_DOT[r.color]}`} title={r.nota} />
              <span className="truncate font-medium">{p.name}</span>
              {p.is_company && <Badge variant="outline">Empresa</Badge>}
            </div>
            <p className="text-muted-foreground text-xs">
              {[
                p.propertyName && [p.propertyName, p.unitLabel].filter(Boolean).join(" "),
                p.giro,
                p.rent_target ? `renta ${formatMXN(p.rent_target)}` : null,
              ]
                .filter(Boolean)
                .join(" · ")}
            </p>
            <p className="text-muted-foreground text-xs">{r.nota}</p>
          </div>
          <button
            onClick={del}
            disabled={pending}
            aria-label="Eliminar"
            className="text-muted-foreground hover:text-destructive shrink-0"
          >
            <Trash2 className="size-4" />
          </button>
        </div>

        {p.stage === "papeleo" && (
          <div className="flex flex-wrap gap-x-3 gap-y-1 border-t pt-2">
            {PAPELEO.map(({ key, label }) => (
              <label key={key} className="flex cursor-pointer items-center gap-1.5 text-xs">
                <input
                  type="checkbox"
                  checked={p[key]}
                  onChange={(e) => togglePapeleo(key, e.target.checked)}
                  disabled={pending}
                  className="size-3.5"
                />
                {label}
              </label>
            ))}
          </div>
        )}

        {p.converted_at ? (
          <p className="text-primary flex items-center gap-1.5 border-t pt-2 text-xs font-medium">
            <UserCheck className="size-3.5" /> Arrendatario creado · activa el contrato en Arrendatarios
          </p>
        ) : (
          p.stage === "cliente" && (
            <Button size="sm" className="w-full" disabled={pending} onClick={convert}>
              <UserPlus className="size-4" /> Convertir en arrendatario
            </Button>
          )
        )}

        <select
          className={selectClass}
          value={p.stage}
          onChange={(e) => move(e.target.value as ProspectStage)}
          disabled={pending}
        >
          {STAGES.map((s) => (
            <option key={s} value={s}>
              Mover a: {PROSPECT_STAGE_LABELS[s]}
            </option>
          ))}
        </select>
      </CardContent>

      <Dialog open={!!creds} onOpenChange={(o) => !o && setCreds(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Arrendatario creado</DialogTitle>
            <DialogDescription>
              Se creó el arrendatario y un contrato borrador. Actívalo en Arrendatarios.
              Comparte estos datos para que entre:
            </DialogDescription>
          </DialogHeader>
          {creds && (
            <div className="bg-muted/40 space-y-2 rounded-lg border p-3 text-sm">
              <p>
                <span className="text-muted-foreground">Correo:</span>{" "}
                <span className="font-medium">{creds.email}</span>
              </p>
              {creds.password && (
                <p className="flex items-center gap-1">
                  <KeyRound className="size-3.5" />
                  <span className="text-muted-foreground">Contraseña temporal:</span>{" "}
                  <span className="font-mono font-medium">{creds.password}</span>
                </p>
              )}
              {creds.inviteLink && (
                <Button
                  size="sm"
                  variant="outline"
                  className="w-full"
                  onClick={() => {
                    navigator.clipboard.writeText(creds.inviteLink!);
                    toast.success("Enlace copiado — compártelo por WhatsApp");
                  }}
                >
                  <LinkIcon className="size-4" /> Copiar enlace de invitación
                </Button>
              )}
            </div>
          )}
          <DialogFooter>
            <Button onClick={() => setCreds(null)}>Listo</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
