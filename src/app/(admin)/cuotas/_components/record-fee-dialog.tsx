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
import { confirmFee } from "../actions";

const selectClass =
  "flex h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50";

const schema = z.object({
  method: z.enum(["spei", "cash", "oxxo", "card", "other"]),
  amount: z.coerce.number().min(0),
  paid_date: z.string().min(1),
});
type FormT = z.infer<typeof schema>;
const today = () => new Date().toISOString().slice(0, 10);

export function RecordFeeDialog({
  feeId,
  amountDue,
}: {
  feeId: string;
  amountDue: number;
}) {
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const router = useRouter();

  const form = useForm<FormT>({
    resolver: zodResolver(schema) as Resolver<FormT>,
    defaultValues: { method: "spei", amount: amountDue, paid_date: today() },
  });
  const { register, handleSubmit } = form;

  function onSubmit(values: FormT) {
    start(async () => {
      const res = await confirmFee(feeId, values);
      if (res?.error) {
        toast.error(res.error);
        return;
      }
      toast.success("Cuota registrada");
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button size="sm" />}>Registrar cuota</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Registrar pago de cuota</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="amount">Monto recibido</Label>
              <Input id="amount" type="number" step="0.01" {...register("amount")} />
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
          <DialogFooter>
            <Button type="submit" disabled={pending}>
              {pending ? "Registrando…" : "Registrar pago"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
