"use client";

import { useTransition } from "react";
import { ImageIcon } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

// Botón genérico para abrir un comprobante (imagen) guardado en el bucket
// privado. Recibe la acción de servidor que firma la URL temporal.
export function ProofButton({
  path,
  getUrl,
  label = "Comprobante",
}: {
  path: string;
  getUrl: (path: string) => Promise<{ url?: string; error?: string }>;
  label?: string;
}) {
  const [pending, start] = useTransition();
  return (
    <Button
      variant="ghost"
      size="sm"
      disabled={pending}
      onClick={() =>
        start(async () => {
          const r = await getUrl(path);
          if (r.url) window.open(r.url, "_blank");
          else toast.error(r.error ?? "No se pudo abrir el comprobante.");
        })
      }
    >
      <ImageIcon className="size-4" /> {label}
    </Button>
  );
}
