"use client";

import { useState, useTransition, type ChangeEvent } from "react";
import { useRouter } from "next/navigation";
import { useForm, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
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
import { createClient } from "@/app/_lib/supabase/client";
import { listingSchema, type ListingInput } from "@/app/_lib/schemas";
import type { ListableUnit } from "@/app/_lib/data/listings";
import { createListing } from "../actions";

const selectClass =
  "flex h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50";

export function ListingDialog({
  orgId,
  units,
}: {
  orgId: string;
  units: ListableUnit[];
}) {
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const [files, setFiles] = useState<File[]>([]);
  const router = useRouter();

  const form = useForm<ListingInput>({
    resolver: zodResolver(listingSchema) as Resolver<ListingInput>,
    defaultValues: {
      unit_id: "",
      title: "",
      description: "",
      rent_amount: 0,
      available_from: "",
      requirements: "",
    },
  });
  const {
    register,
    handleSubmit,
    setValue,
    getValues,
    formState: { errors },
  } = form;

  function onUnitChange(e: ChangeEvent<HTMLSelectElement>) {
    const u = units.find((x) => x.id === e.target.value);
    if (u) {
      setValue("rent_amount", u.rent_amount);
      if (!getValues("title")) {
        setValue("title", `${u.property?.name ? u.property.name + " — " : ""}${u.label}`);
      }
    }
  }

  function onSubmit(values: ListingInput) {
    start(async () => {
      // El bucket listing-photos solo acepta JPG/PNG/WEBP y máx 10 MB.
      const MAX = 10 * 1024 * 1024;
      const OK_TYPES = ["image/png", "image/jpeg", "image/webp"];
      const urls: string[] = [];
      let skipped = 0;
      try {
        const supabase = createClient();
        for (const f of files.slice(0, 12)) {
          if (!OK_TYPES.includes(f.type) || f.size > MAX) {
            toast.error(`${f.name}: usa JPG, PNG o WEBP de máximo 10 MB.`);
            skipped++;
            continue;
          }
          const safe = f.name.replace(/[^a-zA-Z0-9._-]/g, "_");
          const path = `${orgId}/${crypto.randomUUID()}-${safe}`;
          const { error } = await supabase.storage
            .from("listing-photos")
            .upload(path, f, { upsert: false });
          if (error) {
            toast.error(`No se pudo subir ${f.name}`);
            skipped++;
            continue;
          }
          urls.push(
            supabase.storage.from("listing-photos").getPublicUrl(path).data.publicUrl,
          );
        }
      } catch {
        // continue without photos
      }

      const res = await createListing(values, urls);
      if (res?.error) {
        toast.error(res.error);
        return;
      }
      toast.success(
        skipped > 0
          ? `Vacante creada, pero ${skipped} foto${skipped === 1 ? "" : "s"} quedó fuera (revisa formato y tamaño).`
          : "Vacante creada (borrador). Publícala para compartirla.",
      );
      setOpen(false);
      form.reset();
      setFiles([]);
      router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button size="sm" />}>
        <Plus className="size-4" /> Nueva vacante
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nueva vacante</DialogTitle>
        </DialogHeader>
        {units.length === 0 ? (
          <>
            <p className="text-muted-foreground text-sm">
              No tienes unidades disponibles para publicar. Marca una unidad como
              «Disponible» en Propiedades.
            </p>
            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)}>
                Cerrar
              </Button>
            </DialogFooter>
          </>
        ) : (
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="unit_id">Unidad</Label>
              <select
                id="unit_id"
                className={selectClass}
                {...register("unit_id", { onChange: onUnitChange })}
              >
                <option value="">Selecciona una unidad…</option>
                {units.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.property?.name ? `${u.property.name} — ` : ""}
                    {u.label}
                  </option>
                ))}
              </select>
              {errors.unit_id && (
                <p className="text-destructive text-xs">{errors.unit_id.message}</p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="title">Título</Label>
              <Input id="title" {...register("title")} placeholder="Depto en Roma Norte" />
              {errors.title && (
                <p className="text-destructive text-xs">{errors.title.message}</p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="description">Descripción</Label>
              <Textarea id="description" rows={3} {...register("description")} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="rent_amount">Renta (MXN)</Label>
                <Input id="rent_amount" type="number" step="0.01" {...register("rent_amount")} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="available_from">Disponible desde</Label>
                <Input id="available_from" type="date" {...register("available_from")} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="requirements">Requisitos</Label>
              <Textarea
                id="requirements"
                rows={2}
                {...register("requirements")}
                placeholder="Comprobante de ingresos (3x renta), INE, aval o póliza jurídica."
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="photos">Fotos</Label>
              <Input
                id="photos"
                type="file"
                multiple
                accept="image/png,image/jpeg,image/webp"
                onChange={(e) => setFiles(Array.from(e.target.files ?? []))}
              />
              {files.length > 0 && (
                <p className="text-muted-foreground text-xs">
                  {files.length} foto{files.length === 1 ? "" : "s"} seleccionada
                  {files.length === 1 ? "" : "s"}
                </p>
              )}
            </div>
            <DialogFooter>
              <Button type="submit" disabled={pending}>
                {pending ? "Guardando…" : "Crear vacante"}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
