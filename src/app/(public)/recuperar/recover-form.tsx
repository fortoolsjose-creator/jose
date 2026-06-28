"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { requestReset, type RecoverState } from "./actions";

export function RecoverForm() {
  const [state, action, pending] = useActionState<RecoverState, FormData>(
    requestReset,
    {},
  );

  if (state.sent) {
    return (
      <p className="text-muted-foreground text-sm">
        Si ese correo está registrado, te enviamos un enlace para crear una
        nueva contraseña. Revisa tu bandeja de entrada (y la carpeta de spam).
      </p>
    );
  }

  return (
    <form action={action} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="email">Correo</Label>
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          placeholder="tu@correo.com"
        />
      </div>
      {state.error && <p className="text-destructive text-sm">{state.error}</p>}
      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? "Enviando…" : "Enviar enlace"}
      </Button>
    </form>
  );
}
