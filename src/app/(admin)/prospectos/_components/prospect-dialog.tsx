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
import { Textarea } from "@/components/ui/textarea";
import { GUARANTEE_TYPE_LABELS, type GuaranteeType } from "@/app/_lib/types";
import { createProspect } from "../actions";

const selectClass =
  "flex h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50";
const GUARANTEES = Object.keys(GUARANTEE_TYPE_LABELS) as GuaranteeType[];

const schema = z.object({
  name: z.string().trim().min(1, "Escribe el nombre."),
  is_company: z.boolean().optional(),
  contact_phone: z.string().optional(),
  contact_email: z.string().optional(),
  property_id: z.string().optional(),
  giro: z.string().optional(),
  impacto: z.string().optional(),
  monthly_income: z.string().optional(),
  rent_target: z.string().optional(),
  guarantee_type: z.string().optional(),
  notes: z.string().optional(),
});
type FormT = z.infer<typeof schema>;

export function ProspectDialog({ properties }: { properties: { id: string; name: string }[] }) {
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const router = useRouter();
  const form = useForm<FormT>({
    resolver: zodResolver(schema) as Resolver<FormT>,
    defaultValues: {
      name: "", is_company: false, contact_phone: "", contact_email: "",
      property_id: "", giro: "", impacto: "", monthly_income: "", rent_target: "",
      guarantee_type: "", notes: "",
    },
  });
  const { register, handleSubmit, formState: { errors } } = form;

  function onSubmit(values: FormT) {
    start(async () => {
      const res = await createProspect({
        ...values,
        monthly_income: values.monthly_income ? Number(values.monthly_income) : undefined,
        rent_target: values.rent_target ? Number(values.rent_target) : undefined,
      });
      if (res?.error) {
        toast.error(res.error);
        return;
      }
      toast.success("Prospecto agregado");
      setOpen(false);
      form.reset();
      router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button size="sm" />}>
        <Plus className="size-4" /> Nuevo prospecto
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nuevo prospecto</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="name">Nombre o empresa</Label>
            <Input id="name" {...register("name")} placeholder="Ej. Estudio Legal X" />
            {errors.name && <p className="text-destructive text-xs">{errors.name.message}</p>}
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" {...register("is_company")} className="size-4" /> Es empresa
          </label>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="contact_phone">Teléfono</Label>
              <Input id="contact_phone" {...register("contact_phone")} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="contact_email">Correo</Label>
              <Input id="contact_email" {...register("contact_email")} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="property_id">Propiedad de interés</Label>
            <select id="property_id" className={selectClass} {...register("property_id")}>
              <option value="">— Sin definir —</option>
              {properties.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="giro">Giro / actividad en el inmueble</Label>
            <Input id="giro" {...register("giro")} placeholder="Ej. Oficina, restaurante, bodega…" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="impacto">¿En qué impacta? (opcional)</Label>
            <Textarea id="impacto" rows={2} {...register("impacto")} placeholder="Ruido, agua, horario, desgaste…" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="monthly_income">Ingreso mensual</Label>
              <Input id="monthly_income" type="number" min={0} {...register("monthly_income")} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="rent_target">Renta propuesta</Label>
              <Input id="rent_target" type="number" min={0} {...register("rent_target")} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="guarantee_type">Garantía</Label>
            <select id="guarantee_type" className={selectClass} {...register("guarantee_type")}>
              <option value="">— Sin definir —</option>
              {GUARANTEES.map((g) => (
                <option key={g} value={g}>{GUARANTEE_TYPE_LABELS[g]}</option>
              ))}
            </select>
          </div>
          <DialogFooter>
            <Button type="submit" disabled={pending}>
              {pending ? "Guardando…" : "Agregar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
