"use client";

import { useTransition } from "react";
import { FileText } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { getApplicationDocUrl } from "../actions";

export function DocButton({ path, label }: { path: string; label: string }) {
  const [pending, start] = useTransition();
  return (
    <Button
      variant="outline"
      size="sm"
      disabled={pending}
      onClick={() =>
        start(async () => {
          const r = await getApplicationDocUrl(path);
          if (r.url) window.open(r.url, "_blank");
          else toast.error(r.error ?? "No se pudo abrir el documento.");
        })
      }
    >
      <FileText className="size-4" /> {label}
    </Button>
  );
}
