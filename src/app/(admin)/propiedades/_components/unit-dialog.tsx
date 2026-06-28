"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useForm, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Pencil, Plus } from "lucide-react";
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
import { unitSchema, type UnitInput } from "@/app/_lib/schemas";
import type { Unit } from "@/app/_lib/types";
import { createUnit, updateUnit } from "../actions";

const selectClass =
  "flex h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50";

export function UnitDialog({
  propertyId,
  unit,
}: {
  propertyId: string;
  unit?: Unit;
}) {
  const isEdit = !!unit;
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const router = useRouter();

  const form = useForm<UnitInput>({
    resolver: zodResolver(unitSchema) as Resolver<UnitInput>,
    defaultValues: {
      label: unit?.label ?? "",
      bedrooms: unit?.bedrooms ?? undefined,
      bathrooms: unit?.bathrooms ?? undefined,
      rent_amount: unit?.rent_amount ?? 0,
      deposit_amount: unit?.deposit_amount ?? 0,
      status: unit?.status ?? "vacant",
      use_type: unit?.use_type ?? "residential",
    },
  });
  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = form;
  const useType = watch("use_type");

  function onSubmit(values: UnitInput) {
    start(async () => {
      const res = isEdit
        ? await updateUnit(unit!.id, propertyId, values)
        : await createUnit(propertyId, values);
      if (res?.error) {
        toast.error(res.error);
        return;
      }
      toast.success(isEdit ? "Unidad actualizada" : "Unidad creada");
      setOpen(false);
      if (!isEdit) form.reset();
      router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button variant={isEdit ? "ghost" : "default"} size="sm" />
        }
      >
        {isEdit ? (
          <Pencil className="size-4" />
        ) : (
          <>
            <Plus className="size-4" /> Agregar unidad
          </>
        )}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEdit ? "Editar unidad" : "Nueva unidad"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="label">Etiqueta</Label>
            <Input id="label" {...register("label")} placeholder="Depto 1A" />
            {errors.label && (
              <p className="text-destructive text-xs">{errors.label.message}</p>
            )}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="use_type">Uso</Label>
            <select id="use_type" className={selectClass} {...register("use_type")}>
              <option value="residential">Residencial (sin IVA)</option>
              <option value="commercial">Comercial (con IVA 16%)</option>
            </select>
          </div>
          {useType === "residential" && (
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="bedrooms">Recámaras</Label>
                <Input id="bedrooms" type="number" min={0} {...register("bedrooms")} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="bathrooms">Baños</Label>
                <Input
                  id="bathrooms"
                  type="number"
                  min={0}
                  step="0.5"
                  {...register("bathrooms")}
                />
              </div>
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="rent_amount">Renta (MXN)</Label>
              <Input
                id="rent_amount"
                type="number"
                min={0}
                step="0.01"
                {...register("rent_amount")}
              />
              {errors.rent_amount && (
                <p className="text-destructive text-xs">
                  {errors.rent_amount.message}
                </p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="deposit_amount">Depósito (MXN)</Label>
              <Input
                id="deposit_amount"
                type="number"
                min={0}
                step="0.01"
                {...register("deposit_amount")}
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="status">Estado</Label>
            <select id="status" className={selectClass} {...register("status")}>
              <option value="vacant">Disponible</option>
              <option value="occupied">Ocupada</option>
              <option value="maintenance">Mantenimiento</option>
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
