"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
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
import { createEntity } from "../actions";

export function EntityDialog() {
  const [open, setOpen] = useState(false);
  const [nombre, setNombre] = useState("");
  const [rfc, setRfc] = useState("");
  const [regimen, setRegimen] = useState("");
  const [pending, start] = useTransition();
  const router = useRouter();

  function submit() {
    start(async () => {
      const r = await createEntity({ nombre, rfc, regimen });
      if (r.error) {
        toast.error(r.error);
        return;
      }
      toast.success("Sociedad creada");
      setOpen(false);
      setNombre("");
      setRfc("");
      setRegimen("");
      router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button size="sm" />}>
        <Plus className="size-4" /> Nueva sociedad
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nueva sociedad</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="n">Nombre</Label>
            <Input
              id="n"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              placeholder="CIT / PH / SPH / CIMMA"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="r">RFC</Label>
              <Input id="r" value={rfc} onChange={(e) => setRfc(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="reg">Régimen</Label>
              <Input id="reg" value={regimen} onChange={(e) => setRegimen(e.target.value)} />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button onClick={submit} disabled={pending}>
            {pending ? "Guardando…" : "Guardar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
