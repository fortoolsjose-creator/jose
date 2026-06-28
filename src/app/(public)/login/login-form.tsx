"use client";

import Link from "next/link";
import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { signInWithPassword, type EmailState } from "./actions";

// Login por teléfono (SMS) oculto para el lanzamiento: requiere un proveedor de
// SMS configurado en Supabase, que aún no existe. Las acciones sendPhoneOtp /
// verifyPhoneOtp siguen en ./actions; para reactivarlo, vuelve a poner las
// pestañas <Tabs> "Correo" / "Teléfono".
export function LoginForm() {
  const [emailState, emailAction, emailPending] = useActionState<
    EmailState,
    FormData
  >(signInWithPassword, {});

  return (
    <form action={emailAction} className="space-y-4">
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
      <div className="space-y-2">
        <Label htmlFor="password">Contraseña</Label>
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
        />
      </div>
      {emailState.error && (
        <p className="text-destructive text-sm">{emailState.error}</p>
      )}
      <Button type="submit" className="w-full" disabled={emailPending}>
        {emailPending ? "Entrando…" : "Entrar"}
      </Button>
      <p className="text-muted-foreground text-center text-sm">
        <Link
          href="/recuperar"
          className="underline underline-offset-4 hover:text-foreground"
        >
          ¿Olvidaste tu contraseña?
        </Link>
      </p>
    </form>
  );
}
