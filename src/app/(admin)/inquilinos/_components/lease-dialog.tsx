"use client";

import { useState, useTransition, type ChangeEvent } from "react";
import { useRouter } from "next/navigation";
import { useForm, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { KeyRound, Plus } from "lucide-react";
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
import { leaseSchema, type LeaseInput } from "@/app/_lib/schemas";
import type { VacantUnit } from "@/app/_lib/data/leases";
import { createLease } from "../actions";

const selectClass =
  "flex h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50";

const today = () => new Date().toISOString().slice(0, 10);

export function LeaseDialog({ vacantUnits }: { vacantUnits: VacantUnit[] }) {
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const [created, setCreated] = useState<{ email: string; password: string } | null>(
    null,
  );
  const router = useRouter();

  const form = useForm<LeaseInput>({
    resolver: zodResolver(leaseSchema) as Resolver<LeaseInput>,
    defaultValues: {
      unit_id: "",
      tenant_full_name: "",
      tenant_email: "",
      tenant_phone: "",
      start_date: today(),
      end_date: "",
      rent_amount: 0,
      deposit_amount: 0,
      payment_day: 1,
      guarantee_type: "deposito",
      guarantee_notes: "",
      activate: true,
      tenant_is_company: false,
    },
  });
  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors },
  } = form;

  function onUnitChange(e: ChangeEvent<HTMLSelectElement>) {
    const u = vacantUnits.find((x) => x.id === e.target.value);
    if (u) {
      setValue("rent_amount", u.rent_amount);
      setValue("deposit_amount", u.deposit_amount);
    }
  }

  function finish() {
    setOpen(false);
    setCreated(null);
    form.reset();
  }

  function onSubmit(values: LeaseInput) {
    start(async () => {
      const res = await createLease(values);
      if (res?.error) {
        toast.error(res.error);
        return;
      }
      router.refresh();
      if (res.tempPassword) {
        setCreated({
          email: res.tenantEmail ?? values.tenant_email,
          password: res.tempPassword,
        });
      } else {
        toast.success("Contrato creado");
        finish();
      }
    });
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (!o) setCreated(null);
      }}
    >
      <DialogTrigger render={<Button size="sm" />}>
        <Plus className="size-4" /> Nuevo contrato
      </DialogTrigger>
      <DialogContent>
        {created ? (
          <>
            <DialogHeader>
              <DialogTitle>Inquilino invitado</DialogTitle>
              <DialogDescription>
                Comparte estos datos para que entre. También puede usar
                «¿Olvidaste tu contraseña?» con su correo.
              </DialogDescription>
            </DialogHeader>
            <div className="bg-muted/40 space-y-1 rounded-lg border p-3 text-sm">
              <p>
                <span className="text-muted-foreground">Correo:</span>{" "}
                <span className="font-medium">{created.email}</span>
              </p>
              <p className="flex items-center gap-1">
                <KeyRound className="size-3.5" />
                <span className="text-muted-foreground">Contraseña temporal:</span>{" "}
                <span className="font-mono font-medium">{created.password}</span>
              </p>
            </div>
            <DialogFooter>
              <Button onClick={finish}>Listo</Button>
            </DialogFooter>
          </>
        ) : vacantUnits.length === 0 ? (
          <>
            <DialogHeader>
              <DialogTitle>Nuevo contrato</DialogTitle>
            </DialogHeader>
            <p className="text-muted-foreground text-sm">
              No tienes unidades disponibles. Marca una unidad como «Disponible»
              en Propiedades para poder crear un contrato.
            </p>
            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)}>
                Cerrar
              </Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>Nuevo contrato</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="unit_id">Unidad</Label>
                <select
                  id="unit_id"
                  className={selectClass}
                  {...register("unit_id", { onChange: onUnitChange })}
                >
                  <option value="">Selecciona una unidad…</option>
                  {vacantUnits.map((u) => (
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
                <Label htmlFor="tenant_full_name">Nombre del inquilino</Label>
                <Input id="tenant_full_name" {...register("tenant_full_name")} />
                {errors.tenant_full_name && (
                  <p className="text-destructive text-xs">
                    {errors.tenant_full_name.message}
                  </p>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="tenant_email">Correo</Label>
                  <Input id="tenant_email" type="email" {...register("tenant_email")} />
                  {errors.tenant_email && (
                    <p className="text-destructive text-xs">
                      {errors.tenant_email.message}
                    </p>
                  )}
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="tenant_phone">Celular</Label>
                  <Input id="tenant_phone" {...register("tenant_phone")} placeholder="55…" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="start_date">Inicio</Label>
                  <Input id="start_date" type="date" {...register("start_date")} />
                  {errors.start_date && (
                    <p className="text-destructive text-xs">
                      {errors.start_date.message}
                    </p>
                  )}
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="end_date">Fin (opcional)</Label>
                  <Input id="end_date" type="date" {...register("end_date")} />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="rent_amount">Renta</Label>
                  <Input id="rent_amount" type="number" step="0.01" {...register("rent_amount")} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="deposit_amount">Depósito</Label>
                  <Input id="deposit_amount" type="number" step="0.01" {...register("deposit_amount")} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="payment_day">Día de pago</Label>
                  <Input id="payment_day" type="number" min={1} max={31} {...register("payment_day")} />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="guarantee_type">Garantía</Label>
                <select id="guarantee_type" className={selectClass} {...register("guarantee_type")}>
                  <option value="deposito">Depósito</option>
                  <option value="aval">Aval</option>
                  <option value="poliza_juridica">Póliza jurídica</option>
                  <option value="otro">Otro</option>
                </select>
              </div>

              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" {...register("activate")} className="size-4" />
                Activar contrato ahora (marca la unidad como ocupada)
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" {...register("tenant_is_company")} className="size-4" />
                El inquilino es empresa (le retienen 10% de ISR)
              </label>

              <DialogFooter>
                <Button type="submit" disabled={pending}>
                  {pending ? "Creando…" : "Crear contrato"}
                </Button>
              </DialogFooter>
            </form>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
