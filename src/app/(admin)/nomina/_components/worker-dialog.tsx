"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useForm, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Plus } from "lucide-react";
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
import { createWorker } from "../actions";

const selectClass =
  "flex h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50";

const schema = z.object({
  name: z.string().trim().min(1, "Escribe el nombre."),
  role: z.string().optional(),
  pay_frequency: z.string().optional(),
  notes: z.string().optional(),
});
type FormT = z.infer<typeof schema>;

export function WorkerDialog() {
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const router = useRouter();
  const form = useForm<FormT>({
    resolver: zodResolver(schema) as Resolver<FormT>,
    defaultValues: { name: "", role: "", pay_frequency: "quincenal", notes: "" },
  });
  const { register, handleSubmit, formState: { errors } } = form;

  function onSubmit(values: FormT) {
    start(async () => {
      const res = await createWorker(values);
      if (res?.error) {
        toast.error(res.error);
        return;
      }
      toast.success("Persona agregada");
      setOpen(false);
      form.reset();
      router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button size="sm" />}>
        <Plus className="size-4" /> Agregar persona
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Agregar persona</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="name">Nombre</Label>
            <Input id="name" {...register("name")} placeholder="Ej. Faustino…" />
            {errors.name && <p className="text-destructive text-xs">{errors.name.message}</p>}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="role">Puesto</Label>
            <Input id="role" {...register("role")} placeholder="Limpieza, mantenimiento, oficial…" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="pay_frequency">Frecuencia de pago</Label>
            <select id="pay_frequency" className={selectClass} {...register("pay_frequency")}>
              <option value="quincenal">Quincenal</option>
              <option value="mensual">Mensual</option>
            </select>
          </div>
          <DialogFooter>
            <Button type="submit" disabled={pending}>
              {pending ? "Guardando…" : "Guardar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
