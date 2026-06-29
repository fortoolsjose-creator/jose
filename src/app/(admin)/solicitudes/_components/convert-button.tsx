"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { KeyRound, Link as LinkIcon, UserPlus } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { convertToTenant } from "../actions";

export function ConvertButton({
  applicationId,
  disabled,
}: {
  applicationId: string;
  disabled?: boolean;
}) {
  const [pending, start] = useTransition();
  const [open, setOpen] = useState(false);
  const [created, setCreated] = useState<{
    email: string;
    password?: string;
    inviteLink?: string;
  } | null>(null);
  const router = useRouter();

  function convert() {
    start(async () => {
      const r = await convertToTenant(applicationId);
      if (r?.error) {
        toast.error(r.error);
        return;
      }
      router.refresh();
      if (r.tempPassword || r.inviteLink) {
        setCreated({
          email: r.tenantEmail ?? "",
          password: r.tempPassword,
          inviteLink: r.inviteLink,
        });
        setOpen(true);
      } else {
        toast.success("Convertido. Activa el contrato en Arrendatarios.");
      }
    });
  }

  return (
    <>
      <Button size="sm" disabled={pending || disabled} onClick={convert}>
        <UserPlus className="size-4" /> Convertir en arrendatario
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Arrendatario creado</DialogTitle>
            <DialogDescription>
              Se creó el arrendatario y un contrato borrador. Actívalo en Arrendatarios.
              Comparte estos datos para que entre:
            </DialogDescription>
          </DialogHeader>
          {created && (
            <div className="bg-muted/40 space-y-2 rounded-lg border p-3 text-sm">
              <p>
                <span className="text-muted-foreground">Correo:</span>{" "}
                <span className="font-medium">{created.email}</span>
              </p>
              {created.password && (
                <p className="flex items-center gap-1">
                  <KeyRound className="size-3.5" />
                  <span className="text-muted-foreground">Contraseña temporal:</span>{" "}
                  <span className="font-mono font-medium">{created.password}</span>
                </p>
              )}
              {created.inviteLink && (
                <Button
                  size="sm"
                  variant="outline"
                  className="w-full"
                  onClick={() => {
                    navigator.clipboard.writeText(created.inviteLink!);
                    toast.success("Enlace copiado — compártelo por WhatsApp");
                  }}
                >
                  <LinkIcon className="size-4" /> Copiar enlace de invitación
                </Button>
              )}
            </div>
          )}
          <DialogFooter>
            <Button onClick={() => setOpen(false)}>Listo</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
