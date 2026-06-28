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
import { Textarea } from "@/components/ui/textarea";
import { createAnnouncement } from "../actions";

const selectClass =
  "flex h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50";

export function AnnouncementDialog({
  properties,
}: {
  properties: { id: string; name: string }[];
}) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [propertyId, setPropertyId] = useState("");
  const [until, setUntil] = useState("");
  const [pending, start] = useTransition();
  const router = useRouter();

  function submit() {
    start(async () => {
      const r = await createAnnouncement({
        title,
        body,
        property_id: propertyId || undefined,
        until: until || undefined,
      });
      if (r.error) {
        toast.error(r.error);
        return;
      }
      toast.success("Aviso publicado");
      setOpen(false);
      setTitle("");
      setBody("");
      setPropertyId("");
      setUntil("");
      router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button size="sm" />}>
        <Plus className="size-4" /> Nuevo aviso
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nuevo aviso</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="t">Título</Label>
            <Input
              id="t"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Corte de agua el viernes"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="b">Mensaje</Label>
            <Textarea id="b" rows={3} value={body} onChange={(e) => setBody(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="p">Edificio (opcional)</Label>
              <select
                id="p"
                className={selectClass}
                value={propertyId}
                onChange={(e) => setPropertyId(e.target.value)}
              >
                <option value="">Todos</option>
                {properties.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="u">Vigente hasta (opcional)</Label>
              <Input id="u" type="date" value={until} onChange={(e) => setUntil(e.target.value)} />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button onClick={submit} disabled={pending}>
            {pending ? "Publicando…" : "Publicar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
