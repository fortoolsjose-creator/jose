"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

export function ClabeCard({
  clabe,
  banco,
  titular,
}: {
  clabe: string;
  banco: string | null;
  titular: string | null;
}) {
  const [copied, setCopied] = useState(false);

  function copy() {
    navigator.clipboard.writeText(clabe.replace(/\s/g, "")).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }

  return (
    <Card>
      <CardContent className="py-4">
        <p className="text-muted-foreground text-sm">Cuenta para tu depósito</p>
        <div className="mt-1 flex items-center justify-between gap-3">
          <p className="font-mono text-lg font-bold tracking-wide">{clabe}</p>
          <button
            onClick={copy}
            className="text-muted-foreground hover:text-foreground inline-flex shrink-0 items-center gap-1 text-xs"
            aria-label="Copiar CLABE"
          >
            {copied ? <Check className="size-4 text-emerald-600" /> : <Copy className="size-4" />}
            {copied ? "Copiada" : "Copiar"}
          </button>
        </div>
        <p className="text-muted-foreground mt-1 text-xs">
          {[banco, titular].filter(Boolean).join(" · ")}
        </p>
      </CardContent>
    </Card>
  );
}
