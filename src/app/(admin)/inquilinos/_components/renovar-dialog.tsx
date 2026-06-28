"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { RefreshCw } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { formatMXN } from "@/app/_lib/format";
import { renovarContrato } from "../actions";

function addYear(dateStr: string | null): string {
  const base = dateStr ? new Date(dateStr + "T00:00:00") : new Date();
  base.setFullYear(base.getFullYear() + 1);
  return base.toISOString().slice(0, 10);
}

export function RenovarDialog({
  leaseId,
  currentRent,
  currentEnd,
  suggestedPct,
}: {
  leaseId: string;
  currentRent: number;
  currentEnd: string | null;
  suggestedPct: number | null;
}) {
  const [open, setOpen] = useState(false);
  const [pct, setPct] = useState(suggestedPct != null ? String(suggestedPct) : "");
  const [rent, setRent] = useState(
    suggestedPct != null
      ? (currentRent * (1 + suggestedPct / 100)).toFixed(2)
      : String(currentRent),
  );
  const [end, setEnd] = useState(addYear(currentEnd));
  const [note, setNote] = useState("");
  const [pending, start] = useTransition();
  const router = useRouter();

  function onPct(v: string) {
    setPct(v);
    const n = parseFloat(v);
    if (Number.isFinite(n)) setRent((currentRent * (1 + n / 100)).toFixed(2));
  }

  function submit() {
    const newRent = parseFloat(rent);
    if (!Number.isFinite(newRent) || newRent < 0) {
      toast.error("Escribe una renta nueva válida.");
      return;
    }
    start(async () => {
      const r = await renovarContrato(leaseId, {
        increasePct: parseFloat(pct),
        newRent,
        newEnd: end || null,
        note,
      });
      if (r.error) toast.error(r.error);
      else {
        toast.success("Contrato renovado");
        setOpen(false);
        router.refresh();
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button size="sm" variant="outline" />}>
        <RefreshCw className="size-4" /> Renovar
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Renovar contrato</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <p className="text-muted-foreground text-sm">
            Renta actual: <span className="font-medium">{formatMXN(currentRent)}</span>
          </p>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="pct">Incremento (%)</Label>
              <Input
                id="pct"
                type="number"
                step="0.1"
                value={pct}
                onChange={(e) => onPct(e.target.value)}
                placeholder="Ej. 7.5"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="rent">Renta nueva</Label>
              <Input
                id="rent"
                type="number"
                step="0.01"
                value={rent}
                onChange={(e) => setRent(e.target.value)}
              />
            </div>
          </div>
          <p className="text-muted-foreground text-xs">
            La renta nueva se calcula sola con el %; puedes ajustarla a mano si hace falta.
          </p>
          <div className="space-y-1.5">
            <Label htmlFor="end">Nueva vigencia (fin)</Label>
            <Input id="end" type="date" value={end} onChange={(e) => setEnd(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="note">Nota (opcional)</Label>
            <Textarea
              id="note"
              rows={2}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Ej. ajuste por inflación 2026."
            />
          </div>
        </div>
        <DialogFooter>
          <Button onClick={submit} disabled={pending}>
            {pending ? "Guardando…" : "Renovar contrato"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
