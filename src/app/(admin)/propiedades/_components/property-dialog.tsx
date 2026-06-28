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
import { Textarea } from "@/components/ui/textarea";
import { propertySchema, type PropertyInput } from "@/app/_lib/schemas";
import type { Property } from "@/app/_lib/types";
import { createProperty, updateProperty } from "../actions";

const selectClass =
  "flex h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50";

export function PropertyDialog({
  property,
  entities = [],
}: {
  property?: Property;
  entities?: { id: string; nombre: string }[];
}) {
  const isEdit = !!property;
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const router = useRouter();

  const form = useForm<PropertyInput>({
    resolver: zodResolver(propertySchema) as Resolver<PropertyInput>,
    defaultValues: {
      name: property?.name ?? "",
      type: property?.type ?? "apartment",
      street: property?.street ?? "",
      ext_number: property?.ext_number ?? "",
      int_number: property?.int_number ?? "",
      colonia: property?.colonia ?? "",
      municipio: property?.municipio ?? "",
      ciudad: property?.ciudad ?? "",
      cp: property?.cp ?? "",
      notes: property?.notes ?? "",
      market_value: property?.market_value ?? undefined,
      purchase_price: property?.purchase_price ?? undefined,
      purchase_date: property?.purchase_date ?? "",
      clabe: property?.clabe ?? "",
      banco: property?.banco ?? "",
      titular: property?.titular ?? "",
      entity_id: property?.entity_id ?? "",
    },
  });
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = form;

  function onSubmit(values: PropertyInput) {
    start(async () => {
      const res = isEdit
        ? await updateProperty(property!.id, values)
        : await createProperty(values);
      if (res?.error) {
        toast.error(res.error);
        return;
      }
      toast.success(isEdit ? "Propiedad actualizada" : "Propiedad creada");
      setOpen(false);
      if (!isEdit) form.reset();
      router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={<Button variant={isEdit ? "outline" : "default"} size="sm" />}
      >
        {isEdit ? (
          <>
            <Pencil className="size-4" /> Editar
          </>
        ) : (
          <>
            <Plus className="size-4" /> Nueva propiedad
          </>
        )}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEdit ? "Editar propiedad" : "Nueva propiedad"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="name">Nombre</Label>
            <Input id="name" {...register("name")} placeholder="Edificio Roma 45" />
            {errors.name && (
              <p className="text-destructive text-xs">{errors.name.message}</p>
            )}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="type">Tipo</Label>
            <select id="type" className={selectClass} {...register("type")}>
              <option value="apartment">Departamento</option>
              <option value="house">Casa</option>
            </select>
          </div>
          {entities.length > 0 && (
            <div className="space-y-1.5">
              <Label htmlFor="entity_id">Sociedad (entidad legal)</Label>
              <select id="entity_id" className={selectClass} {...register("entity_id")}>
                <option value="">Sin asignar</option>
                {entities.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.nombre}
                  </option>
                ))}
              </select>
            </div>
          )}
          <div className="grid grid-cols-[1fr_auto_auto] gap-2">
            <div className="space-y-1.5">
              <Label htmlFor="street">Calle</Label>
              <Input id="street" {...register("street")} />
            </div>
            <div className="w-20 space-y-1.5">
              <Label htmlFor="ext_number">No. ext</Label>
              <Input id="ext_number" {...register("ext_number")} />
            </div>
            <div className="w-20 space-y-1.5">
              <Label htmlFor="int_number">No. int</Label>
              <Input id="int_number" {...register("int_number")} />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="colonia">Colonia</Label>
              <Input id="colonia" {...register("colonia")} placeholder="Roma Norte" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="municipio">Alcaldía</Label>
              <Input id="municipio" {...register("municipio")} placeholder="Cuauhtémoc" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ciudad">Ciudad</Label>
              <Input id="ciudad" {...register("ciudad")} placeholder="CDMX" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="cp">C.P.</Label>
              <Input id="cp" {...register("cp")} placeholder="06700" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="market_value">Valor del inmueble (opcional)</Label>
              <Input
                id="market_value"
                type="number"
                step="0.01"
                {...register("market_value")}
                placeholder="para el cap rate"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="purchase_price">Precio de compra (opcional)</Label>
              <Input
                id="purchase_price"
                type="number"
                step="0.01"
                {...register("purchase_price")}
                placeholder="lo que se pagó"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="purchase_date">Fecha de compra</Label>
              <Input id="purchase_date" type="date" {...register("purchase_date")} />
            </div>
          </div>
          <div className="space-y-2 rounded-lg border p-3">
            <p className="text-muted-foreground text-xs font-medium">
              Cuenta para depósitos (la ve el inquilino al pagar)
            </p>
            <div className="space-y-1.5">
              <Label htmlFor="clabe">CLABE</Label>
              <Input
                id="clabe"
                inputMode="numeric"
                {...register("clabe")}
                placeholder="18 dígitos"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="banco">Banco</Label>
                <Input id="banco" {...register("banco")} placeholder="BBVA" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="titular">Titular</Label>
                <Input id="titular" {...register("titular")} placeholder="Razón social" />
              </div>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="notes">Notas</Label>
            <Textarea id="notes" {...register("notes")} rows={2} />
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
