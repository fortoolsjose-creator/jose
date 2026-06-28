"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useForm, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { CalendarPlus } from "lucide-react";
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
import { MAINTENANCE_CATEGORY_LABELS, type MaintenanceCategory } from "@/app/_lib/types";
import { createPlan } from "../actions";

const selectClass =
  "flex h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50";
const CATEGORIES = Object.keys(MAINTENANCE_CATEGORY_LABELS) as MaintenanceCategory[];
const today = () => new Date().toISOString().slice(0, 10);

const schema = z.object({
  title: z.string().trim().min(1, "Escribe un título."),
  category: z.enum(["plomeria", "electricidad", "cerrajeria", "electrodomesticos", "limpieza", "otro"]),
  property_id: z.string().optional(),
  frequency_months: z.coerce.number().int().min(1).max(60),
  next_due: z.string().min(1),
});
type FormT = z.infer<typeof schema>;

export function PlanDialog({ properties }: { properties: { id: string; name: string }[] }) {
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const router = useRouter();
  const form = useForm<FormT>({
    resolver: zodResolver(schema) as Resolver<FormT>,
    defaultValues: {
      title: "",
      category: "otro",
      property_id: "",
      frequency_months: 3,
      next_due: today(),
    },
  });
  const { register, handleSubmit, formState: { errors } } = form;

  function onSubmit(values: FormT) {
    start(async () => {
      const res = await createPlan(values);
      if (res?.error) {
        toast.error(res.error);
        return;
      }
      toast.success("Plan creado");
      setOpen(false);
      form.reset();
      router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button size="sm" variant="outline" />}>
        <CalendarPlus className="size-4" /> Nuevo plan
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nuevo plan preventivo</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="title">¿Qué se hace?</Label>
            <Input id="title" {...register("title")} placeholder="Ej. Fumigación, revisión de bombas…" />
            {errors.title && <p className="text-destructive text-xs">{errors.title.message}</p>}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="category">Tipo</Label>
            <select id="category" className={selectClass} {...register("category")}>
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>{MAINTENANCE_CATEGORY_LABELS[c]}</option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="property_id">Edificio (opcional)</Label>
            <select id="property_id" className={selectClass} {...register("property_id")}>
              <option value="">General / todo el negocio</option>
              {properties.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="frequency_months">Cada cuántos meses</Label>
              <Input id="frequency_months" type="number" min={1} max={60} {...register("frequency_months")} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="next_due">Próxima fecha</Label>
              <Input id="next_due" type="date" {...register("next_due")} />
            </div>
          </div>
          <DialogFooter>
            <Button type="submit" disabled={pending}>
              {pending ? "Guardando…" : "Crear plan"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
