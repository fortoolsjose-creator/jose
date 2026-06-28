"use client";

import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";

/** Pantalla de error reutilizable (la usan los error.tsx de cada grupo de rutas). */
export function ErrorScreen({
  reset,
  homeHref = "/",
}: {
  reset: () => void;
  homeHref?: string;
}) {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 p-8 text-center">
      <AlertTriangle className="text-destructive size-10" />
      <div className="space-y-1">
        <h1 className="text-lg font-semibold">Algo salió mal</h1>
        <p className="text-muted-foreground mx-auto max-w-sm text-sm">
          Tuvimos un problema al cargar esta pantalla. Vuelve a intentar; si sigue
          fallando, recarga la página.
        </p>
      </div>
      <div className="flex items-center gap-3">
        <Button onClick={reset}>Reintentar</Button>
        <a
          href={homeHref}
          className="text-muted-foreground hover:text-foreground text-sm underline underline-offset-4"
        >
          Ir al inicio
        </a>
      </div>
    </div>
  );
}
