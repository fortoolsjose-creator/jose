"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, FileText, Trash2, Upload, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createClient } from "@/app/_lib/supabase/client";
import { addDocument, deleteDocument } from "@/app/_lib/expediente-actions";
import { DOCUMENT_KIND_LABELS, type DocumentOwnerType } from "@/app/_lib/types";
import type { DocRow } from "@/app/_lib/data/documents";

const selectClass =
  "flex h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50";

const kindLabel = (k: string | null) => (k ? (DOCUMENT_KIND_LABELS[k] ?? k) : "Documento");

export function ExpedienteDocs({
  orgId,
  ownerType,
  ownerId,
  docs,
  kindOptions,
  expectedKinds,
}: {
  orgId: string;
  ownerType: DocumentOwnerType;
  ownerId: string;
  docs: DocRow[];
  kindOptions: string[];
  expectedKinds: string[];
}) {
  const [kind, setKind] = useState(kindOptions[0] ?? "otro");
  const [file, setFile] = useState<File | null>(null);
  const [pending, start] = useTransition();
  const router = useRouter();

  const present = new Set(docs.map((d) => d.kind ?? "otro"));

  function upload() {
    if (!file) {
      toast.error("Elige un archivo.");
      return;
    }
    if (file.size > 15 * 1024 * 1024) {
      toast.error("El archivo pesa más de 15 MB.");
      return;
    }
    start(async () => {
      try {
        const supabase = createClient();
        const safe = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
        const path = `${orgId}/${ownerType}/${ownerId}/${crypto.randomUUID()}-${safe}`;
        const { error } = await supabase.storage
          .from("documents")
          .upload(path, file, { upsert: false });
        if (error) {
          toast.error("No se pudo subir el archivo.");
          return;
        }
        const r = await addDocument({ ownerType, ownerId, kind, name: file.name, path });
        if (r.error) {
          toast.error(r.error);
          return;
        }
        toast.success("Documento agregado");
        setFile(null);
        router.refresh();
      } catch {
        toast.error("No se pudo subir el archivo.");
      }
    });
  }

  function remove(id: string) {
    start(async () => {
      const r = await deleteDocument(id);
      if (r.error) toast.error(r.error);
      else {
        toast.success("Documento quitado");
        router.refresh();
      }
    });
  }

  return (
    <div className="space-y-4">
      {expectedKinds.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {expectedKinds.map((k) => {
            const ok = present.has(k);
            return (
              <span
                key={k}
                className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs ${
                  ok
                    ? "border-primary/30 bg-primary/10 text-foreground"
                    : "text-muted-foreground border-dashed"
                }`}
              >
                {ok ? <Check className="size-3" /> : <X className="size-3" />}
                {kindLabel(k)}
              </span>
            );
          })}
        </div>
      )}

      {docs.length > 0 ? (
        <div className="space-y-2">
          {docs.map((d) => (
            <div
              key={d.id}
              className="flex items-center justify-between gap-3 rounded-lg border px-3 py-2"
            >
              <div className="flex min-w-0 items-center gap-2">
                <FileText className="text-muted-foreground size-4 shrink-0" />
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{kindLabel(d.kind)}</p>
                  <p className="text-muted-foreground truncate text-xs">{d.name}</p>
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-1">
                {d.signedUrl && (
                  <a
                    href={d.signedUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary text-sm font-medium hover:underline"
                  >
                    Ver
                  </a>
                )}
                <Button
                  variant="ghost"
                  size="icon"
                  disabled={pending}
                  aria-label="Quitar"
                  onClick={() => remove(d.id)}
                >
                  <Trash2 className="size-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-muted-foreground text-sm">Aún no hay documentos en el expediente.</p>
      )}

      <div className="bg-muted/30 flex flex-wrap items-end gap-3 rounded-lg border p-3">
        <div className="space-y-1.5">
          <Label htmlFor="doc-kind">Tipo de documento</Label>
          <select
            id="doc-kind"
            className={selectClass}
            value={kind}
            onChange={(e) => setKind(e.target.value)}
          >
            {kindOptions.map((k) => (
              <option key={k} value={k}>
                {kindLabel(k)}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="doc-file">Archivo</Label>
          <Input
            id="doc-file"
            type="file"
            accept="image/*,application/pdf"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          />
        </div>
        <Button size="sm" onClick={upload} disabled={pending || !file}>
          <Upload className="size-4" /> {pending ? "Subiendo…" : "Agregar"}
        </Button>
      </div>
    </div>
  );
}
