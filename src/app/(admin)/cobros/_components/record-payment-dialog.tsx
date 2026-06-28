"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useForm, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
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
import { createClient } from "@/app/_lib/supabase/client";
import { formatMXN } from "@/app/_lib/format";
import { confirmPayment } from "../actions";

const selectClass =
  "flex h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50";

const schema = z.object({
  method: z.enum(["spei", "cash", "oxxo", "card", "other"]),
  reference: z.string().optional(),
  amount: z.coerce.number().min(0),
  paid_date: z.string().min(1),
  fiscal_status: z.enum(["con_factura", "sin_factura", "pendiente"]),
});
type FormT = z.infer<typeof schema>;

const today = () => new Date().toISOString().slice(0, 10);

export function RecordPaymentDialog({
  paymentId,
  amountDue,
  amountPaid = 0,
  suggestedReference,
  orgId,
}: {
  paymentId: string;
  amountDue: number;
  amountPaid?: number;
  suggestedReference?: string | null;
  orgId: string;
}) {
  const [open, setOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [pending, start] = useTransition();
  const router = useRouter();

  const restante = Math.max(0, Math.round((amountDue - amountPaid) * 100) / 100);

  const form = useForm<FormT>({
    resolver: zodResolver(schema) as Resolver<FormT>,
    defaultValues: {
      method: "spei",
      reference: suggestedReference ?? "",
      amount: restante > 0 ? restante : amountDue,
      paid_date: today(),
      fiscal_status: "pendiente",
    },
  });
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = form;

  function onSubmit(values: FormT) {
    start(async () => {
      let proofPath: string | null = null;
      if (file) {
        if (file.size > 15 * 1024 * 1024) {
          toast.error("La imagen pesa más de 15 MB. Usa una más ligera.");
          return;
        }
        try {
          const supabase = createClient();
          const safe = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
          const path = `${orgId}/comprobantes/${paymentId}-${crypto.randomUUID()}-${safe}`;
          const { error } = await supabase.storage
            .from("documents")
            .upload(path, file, { upsert: false });
          if (error) toast.error("No se pudo subir el comprobante; registramos el pago sin él.");
          else proofPath = path;
        } catch {
          toast.error("No se pudo subir el comprobante; registramos el pago sin él.");
        }
      }

      const res = await confirmPayment(paymentId, values, proofPath);
      if (res?.error) {
        toast.error(res.error);
        return;
      }
      toast.success("Pago registrado");
      setOpen(false);
      setFile(null);
      router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button size="sm" />}>Registrar pago</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Registrar pago</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="amount">Monto de este pago</Label>
              <Input
                id="amount"
                type="number"
                inputMode="decimal"
                step="0.01"
                aria-invalid={!!errors.amount}
                aria-describedby={errors.amount ? "amount-error" : undefined}
                {...register("amount")}
              />
              {amountPaid > 0 && (
                <p className="text-muted-foreground text-xs">
                  Ya abonó {formatMXN(amountPaid)} · falta {formatMXN(restante)}
                </p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="paid_date">Fecha de pago</Label>
              <Input id="paid_date" type="date" {...register("paid_date")} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="method">Método</Label>
            <select id="method" className={selectClass} {...register("method")}>
              <option value="spei">SPEI</option>
              <option value="cash">Efectivo</option>
              <option value="oxxo">OXXO</option>
              <option value="card">Tarjeta</option>
              <option value="other">Otro</option>
            </select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="reference">Referencia (clave de rastreo / folio)</Label>
            <Input id="reference" {...register("reference")} placeholder="Opcional" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="fiscal_status">¿Se facturó?</Label>
            <select id="fiscal_status" className={selectClass} {...register("fiscal_status")}>
              <option value="pendiente">Factura pendiente</option>
              <option value="con_factura">Con factura</option>
              <option value="sin_factura">Sin factura</option>
            </select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="proof">Comprobante (opcional)</Label>
            <Input
              id="proof"
              type="file"
              accept="image/*,application/pdf"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />
            {file && <p className="text-muted-foreground text-xs">{file.name}</p>}
          </div>
          {errors.amount && (
            <p id="amount-error" className="text-destructive text-xs">
              {errors.amount.message}
            </p>
          )}
          <DialogFooter>
            <Button type="submit" disabled={pending}>
              {pending ? "Registrando…" : "Registrar y generar recibo"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
