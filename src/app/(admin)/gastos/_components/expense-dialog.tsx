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
import { expenseSchema, type ExpenseInput } from "@/app/_lib/schemas";
import { EXPENSE_CATEGORY_LABELS, type Expense, type ExpenseCategory } from "@/app/_lib/types";
import { createExpense, updateExpense } from "../actions";

const selectClass =
  "flex h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50";
const today = () => new Date().toISOString().slice(0, 10);
const CATEGORIES = Object.keys(EXPENSE_CATEGORY_LABELS) as ExpenseCategory[];

export function ExpenseDialog({
  properties,
  entities = [],
  expense,
}: {
  properties: { id: string; name: string }[];
  entities?: { id: string; nombre: string }[];
  expense?: Expense;
}) {
  const isEdit = !!expense;
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const [compartido, setCompartido] = useState(false);
  const [reparto, setReparto] = useState<Record<string, string>>({});
  const router = useRouter();

  const form = useForm<ExpenseInput>({
    resolver: zodResolver(expenseSchema) as Resolver<ExpenseInput>,
    defaultValues: {
      property_id: expense?.property_id ?? "",
      category: expense?.category ?? "mantenimiento",
      vendor: expense?.vendor ?? "",
      description: expense?.description ?? "",
      amount: expense?.amount ?? 0,
      expense_date: expense?.expense_date ?? today(),
      has_invoice: expense?.has_invoice ?? false,
    },
  });
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = form;

  function onSubmit(values: ExpenseInput) {
    const allocations =
      !isEdit && compartido
        ? entities
            .map((e) => ({ entity_id: e.id, proportion: parseFloat(reparto[e.id] ?? "") || 0 }))
            .filter((a) => a.proportion > 0)
        : undefined;
    start(async () => {
      const res = isEdit
        ? await updateExpense(expense!.id, values)
        : await createExpense(values, allocations);
      if (res?.error) {
        toast.error(res.error);
        return;
      }
      toast.success(isEdit ? "Gasto actualizado" : "Gasto registrado");
      setOpen(false);
      if (!isEdit) {
        form.reset();
        setCompartido(false);
        setReparto({});
      }
      router.refresh();
    });
  }

  const sumaReparto = entities.reduce((s, e) => s + (parseFloat(reparto[e.id] ?? "") || 0), 0);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant={isEdit ? "ghost" : "default"} size="sm" />}>
        {isEdit ? <Pencil className="size-4" /> : <><Plus className="size-4" /> Nuevo gasto</>}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEdit ? "Editar gasto" : "Nuevo gasto"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="amount">Monto (MXN)</Label>
              <Input id="amount" type="number" step="0.01" {...register("amount")} />
              {errors.amount && <p className="text-destructive text-xs">{errors.amount.message}</p>}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="expense_date">Fecha</Label>
              <Input id="expense_date" type="date" {...register("expense_date")} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="category">Categoría</Label>
            <select id="category" className={selectClass} {...register("category")}>
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>{EXPENSE_CATEGORY_LABELS[c]}</option>
              ))}
            </select>
          </div>
          {!isEdit && entities.length > 0 && (
            <label className="flex cursor-pointer items-center gap-2 text-sm">
              <input
                type="checkbox"
                className="accent-primary size-4"
                checked={compartido}
                onChange={(e) => setCompartido(e.target.checked)}
              />
              Gasto <span className="font-medium">compartido</span> entre sociedades
            </label>
          )}
          {compartido ? (
            <div className="space-y-2 rounded-lg border p-3">
              <p className="text-muted-foreground text-xs">
                Reparte el gasto por % entre las sociedades (debe sumar 100%).
              </p>
              {entities.map((e) => (
                <div key={e.id} className="flex items-center gap-2">
                  <span className="flex-1 text-sm">{e.nombre}</span>
                  <Input
                    type="number"
                    min={0}
                    max={100}
                    step="0.01"
                    value={reparto[e.id] ?? ""}
                    onChange={(ev) => setReparto((r) => ({ ...r, [e.id]: ev.target.value }))}
                    className="w-24"
                    placeholder="%"
                  />
                </div>
              ))}
              <p
                className={`text-xs ${Math.abs(sumaReparto - 100) > 0.5 ? "text-destructive" : "text-muted-foreground"}`}
              >
                Suma: {sumaReparto}%
              </p>
            </div>
          ) : (
            <div className="space-y-1.5">
              <Label htmlFor="property_id">Edificio</Label>
              <select id="property_id" className={selectClass} {...register("property_id")}>
                <option value="">General / todo el negocio</option>
                {properties.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>
          )}
          <div className="space-y-1.5">
            <Label htmlFor="vendor">Proveedor / a quién se pagó</Label>
            <Input id="vendor" {...register("vendor")} placeholder="Ej. Plomería Pizarro" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="description">Nota</Label>
            <Textarea id="description" rows={2} {...register("description")} />
          </div>
          <label className="flex cursor-pointer items-center gap-2 text-sm">
            <input
              type="checkbox"
              className="accent-primary size-4"
              {...register("has_invoice")}
            />
            Este gasto tiene <span className="font-medium">factura</span> (deducible)
          </label>
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
