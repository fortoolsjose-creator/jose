"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createClient } from "@/app/_lib/supabase/client";
import { markAsPaid } from "../actions";

const selectClass =
  "flex h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50";

const schema = z.object({
  reference: z.string().trim().min(3, "Escribe tu clave de rastreo."),
  method: z.enum(["spei", "cash", "oxxo", "other"]),
});
type FormT = z.infer<typeof schema>;

export function MarkPaidDialog({
  paymentId,
  orgId,
  userId,
}: {
  paymentId: string;
  orgId: string;
  userId: string;
}) {
  const [open, setOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [pending, start] = useTransition();
  const router = useRouter();
  const form = useForm<FormT>({
    resolver: zodResolver(schema),
    defaultValues: { reference: "", method: "spei" },
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
          const path = `${orgId}/${userId}/comprobantes/${crypto.randomUUID()}-${safe}`;
          const { error } = await supabase.storage
            .from("documents")
            .upload(path, file, { upsert: false });
          if (error) toast.error("No se pudo subir el comprobante; enviamos el aviso sin él.");
          else proofPath = path;
        } catch {
          toast.error("No se pudo subir el comprobante; enviamos el aviso sin él.");
        }
      }

      const res = await markAsPaid(paymentId, values, proofPath);
      if (res?.error) {
        toast.error(res.error);
        return;
      }
      toast.success("Enviado. Tu arrendador lo confirmará.");
      setOpen(false);
      setFile(null);
      form.reset();
      router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button size="sm" />}>Ya pagué</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Avisar de tu pago</DialogTitle>
          <DialogDescription>
            Haz tu transferencia SPEI a la cuenta que aparece en tu pantalla de Mi
            renta y registra aquí tu clave de rastreo. Tu arrendador la confirma.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="method">¿Cómo pagaste?</Label>
            <select id="method" className={selectClass} {...register("method")}>
              <option value="spei">SPEI (transferencia)</option>
              <option value="cash">Efectivo</option>
              <option value="oxxo">OXXO</option>
              <option value="other">Otro</option>
            </select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="reference">Clave de rastreo / referencia</Label>
            <Input
              id="reference"
              inputMode="numeric"
              aria-invalid={!!errors.reference}
              aria-describedby={errors.reference ? "reference-error" : undefined}
              {...register("reference")}
              placeholder="Ej. 2026061812345…"
            />
            {errors.reference && (
              <p id="reference-error" className="text-destructive text-xs">
                {errors.reference.message}
              </p>
            )}
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
          <DialogFooter>
            <Button type="submit" disabled={pending}>
              {pending ? "Enviando…" : "Enviar aviso de pago"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
