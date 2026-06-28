"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useForm, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { ClipboardCheck } from "lucide-react";
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
import { Textarea } from "@/components/ui/textarea";
import { MAINTENANCE_CATEGORY_LABELS, type MaintenanceCategory } from "@/app/_lib/types";
import { registrarMantenimiento } from "../actions";

const selectClass =
  "flex h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50";
const CATS = Object.keys(MAINTENANCE_CATEGORY_LABELS) as MaintenanceCategory[];
const today = () => new Date().toISOString().slice(0, 10);

const schema = z.object({
  title: z.string().trim().min(1, "Escribe qué se hizo."),
  mtype: z.enum(["correctivo", "preventivo"]),
  category: z.enum(["plomeria", "electricidad", "cerrajeria", "electrodomesticos", "limpieza", "otro"]),
  property_id: z.string().optional(),
  unit_id: z.string().optional(),
  worker_id: z.string().optional(),
  fecha: z.string().min(1),
  cost: z.string().optional(),
  description: z.string().optional(),
});
type FormT = z.infer<typeof schema>;

export function RegistrarMttoDialog({
  properties,
  units,
  workers,
}: {
  properties: { id: string; name: string }[];
  units: { id: string; label: string; property: string }[];
  workers: { id: string; name: string }[];
}) {
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const router = useRouter();
  const form = useForm<FormT>({
    resolver: zodResolver(schema) as Resolver<FormT>,
    defaultValues: {
      title: "", mtype: "correctivo", category: "otro",
      property_id: "", unit_id: "", worker_id: "", fecha: today(), cost: "", description: "",
    },
  });
  const { register, handleSubmit, formState: { errors } } = form;

  function onSubmit(values: FormT) {
    start(async () => {
      const res = await registrarMantenimiento({
        ...values,
        cost: values.cost ? Number(values.cost) : undefined,
      });
      if (res?.error) {
        toast.error(res.error);
        return;
      }
      toast.success("Mantenimiento registrado");
      setOpen(false);
      form.reset();
      router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button size="sm" />}>
        <ClipboardCheck className="size-4" /> Registrar mantenimiento
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Registrar mantenimiento hecho</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="title">¿Qué se hizo?</Label>
            <Input id="title" {...register("title")} placeholder="Ej. Cambio de bomba de agua" />
            {errors.title && <p className="text-destructive text-xs">{errors.title.message}</p>}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="mtype">Tipo</Label>
              <select id="mtype" className={selectClass} {...register("mtype")}>
                <option value="correctivo">Correctivo</option>
                <option value="preventivo">Preventivo</option>
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="category">Categoría</Label>
              <select id="category" className={selectClass} {...register("category")}>
                {CATS.map((c) => (
                  <option key={c} value={c}>{MAINTENANCE_CATEGORY_LABELS[c]}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="property_id">Edificio</Label>
            <select id="property_id" className={selectClass} {...register("property_id")}>
              <option value="">— General —</option>
              {properties.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="unit_id">Unidad (opcional)</Label>
            <select id="unit_id" className={selectClass} {...register("unit_id")}>
              <option value="">— Todo el edificio —</option>
              {units.map((u) => (
                <option key={u.id} value={u.id}>{u.property} · {u.label}</option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="worker_id">Quién lo hizo</Label>
              <select id="worker_id" className={selectClass} {...register("worker_id")}>
                <option value="">— Sin asignar —</option>
                {workers.map((w) => (
                  <option key={w.id} value={w.id}>{w.name}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="cost">Costo (opcional)</Label>
              <Input id="cost" type="number" min={0} step="0.01" {...register("cost")} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="fecha">Fecha</Label>
            <Input id="fecha" type="date" {...register("fecha")} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="description">Notas (opcional)</Label>
            <Textarea id="description" rows={2} {...register("description")} />
          </div>
          <DialogFooter>
            <Button type="submit" disabled={pending}>
              {pending ? "Guardando…" : "Registrar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
