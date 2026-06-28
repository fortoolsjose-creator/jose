"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { CheckCircle2, Wrench } from "lucide-react";
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
import { Textarea } from "@/components/ui/textarea";
import { createClient } from "@/app/_lib/supabase/client";
import { requestSchema, type RequestInput } from "@/app/_lib/schemas";
import { createRequest } from "../actions";

const selectClass =
  "flex h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50";

export function ReportDialog({
  orgId,
  userId,
  full = false,
}: {
  orgId: string;
  userId: string;
  full?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [done, setDone] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [pending, start] = useTransition();
  const router = useRouter();

  const form = useForm<RequestInput>({
    resolver: zodResolver(requestSchema),
    defaultValues: { title: "", category: "plomeria", description: "" },
  });
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = form;

  function close() {
    setOpen(false);
    setDone(false);
    setFile(null);
    form.reset();
  }

  function onSubmit(values: RequestInput) {
    start(async () => {
      // Sube la foto (opcional) al bucket privado del inquilino, si hay.
      let photoPath: string | null = null;
      if (file) {
        if (file.size > 15 * 1024 * 1024) {
          toast.error("La imagen pesa más de 15 MB. Usa una más ligera.");
          return;
        }
        try {
          const supabase = createClient();
          const safe = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
          const path = `${orgId}/${userId}/reportes/${crypto.randomUUID()}-${safe}`;
          const { error } = await supabase.storage
            .from("documents")
            .upload(path, file, { upsert: false });
          if (error) {
            toast.error("No se pudo subir la imagen; enviamos el reporte sin ella.");
          } else {
            photoPath = path;
          }
        } catch {
          toast.error("No se pudo subir la imagen; enviamos el reporte sin ella.");
        }
      }

      const res = await createRequest(values, photoPath);
      if (res?.error) {
        toast.error(res.error);
        return;
      }
      setDone(true);
      router.refresh();
    });
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (!o) {
          setDone(false);
          setFile(null);
        }
      }}
    >
      <DialogTrigger
        render={
          <Button size={full ? "lg" : "sm"} className={full ? "w-full" : undefined} />
        }
      >
        <Wrench className="size-4" /> Reportar un problema
      </DialogTrigger>
      <DialogContent>
        {done ? (
          <div className="space-y-4 py-2 text-center">
            <div className="bg-primary/10 mx-auto flex size-14 items-center justify-center rounded-full">
              <CheckCircle2 className="text-primary size-7" />
            </div>
            <DialogHeader>
              <DialogTitle className="text-center">¡Recibimos tu reporte!</DialogTitle>
              <DialogDescription className="text-center">
                Te atendemos pronto. Puedes seguir su avance en «Mis reportes».
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button onClick={close} className="w-full">
                Listo
              </Button>
            </DialogFooter>
          </div>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>Reportar un problema</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="title">¿Qué pasó?</Label>
                <Input id="title" {...register("title")} placeholder="Ej. Fuga en el baño" />
                {errors.title && (
                  <p className="text-destructive text-xs">{errors.title.message}</p>
                )}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="category">Tipo</Label>
                <select id="category" className={selectClass} {...register("category")}>
                  <option value="plomeria">Plomería</option>
                  <option value="electricidad">Electricidad</option>
                  <option value="cerrajeria">Cerrajería</option>
                  <option value="electrodomesticos">Electrodomésticos</option>
                  <option value="limpieza">Limpieza</option>
                  <option value="otro">Otro</option>
                </select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="description">Detalles (opcional)</Label>
                <Textarea
                  id="description"
                  {...register("description")}
                  rows={3}
                  placeholder="Cuéntanos más para atenderte mejor…"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="photo">Foto del problema (opcional)</Label>
                <Input
                  id="photo"
                  type="file"
                  accept="image/*"
                  onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                />
                {file && (
                  <p className="text-muted-foreground text-xs">{file.name}</p>
                )}
              </div>
              <DialogFooter>
                <Button type="submit" disabled={pending}>
                  {pending ? "Enviando…" : "Enviar reporte"}
                </Button>
              </DialogFooter>
            </form>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
