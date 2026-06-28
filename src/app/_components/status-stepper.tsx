import { cn } from "@/lib/utils";
import type { MaintenanceStatus } from "@/app/_lib/types";

const STEPS: { key: MaintenanceStatus; label: string }[] = [
  { key: "recibido", label: "Recibido" },
  { key: "en_proceso", label: "En proceso" },
  { key: "resuelto", label: "Resuelto" },
];

const ORDER: Record<MaintenanceStatus, number> = {
  recibido: 0,
  en_proceso: 1,
  resuelto: 2,
  cancelado: -1,
};

export function StatusStepper({ status }: { status: MaintenanceStatus }) {
  if (status === "cancelado") {
    return (
      <p className="text-muted-foreground text-sm">Este reporte fue cancelado.</p>
    );
  }
  const current = ORDER[status];
  return (
    <div className="flex flex-wrap items-center gap-2">
      {STEPS.map((s, i) => (
        <div key={s.key} className="flex items-center gap-2">
          <span
            className={cn(
              "rounded-full px-3 py-1 text-xs font-medium",
              i <= current
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground",
            )}
          >
            {s.label}
          </span>
          {i < STEPS.length - 1 && (
            <span
              className={cn("h-px w-5", i < current ? "bg-primary" : "bg-border")}
            />
          )}
        </div>
      ))}
    </div>
  );
}
