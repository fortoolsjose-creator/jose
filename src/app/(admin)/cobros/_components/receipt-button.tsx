"use client";

import { useTransition } from "react";
import { FileText } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { getReceiptUrl } from "../actions";

export function ReceiptButton({ path }: { path: string }) {
  const [pending, start] = useTransition();
  return (
    <Button
      variant="ghost"
      size="sm"
      disabled={pending}
      onClick={() =>
        start(async () => {
          const r = await getReceiptUrl(path);
          if (r.url) window.open(r.url, "_blank");
          else toast.error(r.error ?? "No se pudo abrir el recibo.");
        })
      }
    >
      <FileText className="size-4" /> Recibo
    </Button>
  );
}
