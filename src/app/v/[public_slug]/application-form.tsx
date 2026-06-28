"use client";

import { useActionState } from "react";
import { CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { submitApplication, type ApplicationState } from "./actions";

const selectClass =
  "flex h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50";

export function ApplicationForm({ listingId }: { listingId: string }) {
  const [state, action, pending] = useActionState<ApplicationState, FormData>(
    submitApplication,
    {},
  );

  if (state.ok) {
    return (
      <div className="bg-muted/40 flex flex-col items-center gap-2 rounded-lg border p-6 text-center">
        <CheckCircle2 className="text-primary size-8" />
        <p className="font-medium">¡Gracias! Recibimos tu solicitud.</p>
        <p className="text-muted-foreground text-sm">
          El arrendador la revisará y te contactará.
        </p>
      </div>
    );
  }

  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="listing_id" value={listingId} />

      <div className="space-y-1.5">
        <Label htmlFor="applicant_name">Nombre completo</Label>
        <Input id="applicant_name" name="applicant_name" required />
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="applicant_email">Correo</Label>
          <Input id="applicant_email" name="applicant_email" type="email" required />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="applicant_phone">Teléfono</Label>
          <Input id="applicant_phone" name="applicant_phone" type="tel" />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="monthly_income">Ingreso mensual (MXN)</Label>
        <Input id="monthly_income" name="monthly_income" type="number" step="0.01" />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="guarantee_type">Garantía</Label>
        <select id="guarantee_type" name="guarantee_type" className={selectClass} defaultValue="aval">
          <option value="aval">Aval</option>
          <option value="poliza_juridica">Póliza jurídica</option>
        </select>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="income_proof">Comprobante de ingresos (PDF o imagen)</Label>
        <Input id="income_proof" name="income_proof" type="file" accept="image/*,application/pdf" />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="id_doc">INE (identificación)</Label>
        <Input id="id_doc" name="id_doc" type="file" accept="image/*,application/pdf" />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="guarantee_doc">Documento de garantía (opcional)</Label>
        <Input id="guarantee_doc" name="guarantee_doc" type="file" accept="image/*,application/pdf" />
      </div>

      <div className="flex items-start gap-2 pt-1">
        <input
          id="privacy_accept"
          name="privacy_accept"
          type="checkbox"
          required
          className="accent-primary mt-0.5 size-4 shrink-0"
        />
        <Label
          htmlFor="privacy_accept"
          className="text-muted-foreground text-xs leading-snug font-normal"
        >
          He leído y acepto el{" "}
          <a
            href="/aviso-de-privacidad"
            target="_blank"
            className="text-primary underline underline-offset-2"
          >
            aviso de privacidad
          </a>{" "}
          y autorizo el tratamiento de mis datos para evaluar mi solicitud.
        </Label>
      </div>

      {state.error && <p className="text-destructive text-sm">{state.error}</p>}

      <Button type="submit" disabled={pending} className="w-full">
        {pending ? "Enviando…" : "Enviar solicitud"}
      </Button>
    </form>
  );
}
