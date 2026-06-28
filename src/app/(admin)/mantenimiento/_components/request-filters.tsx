"use client";

import type { Route } from "next";
import { useRouter, useSearchParams } from "next/navigation";

const selectClass =
  "flex h-8 rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50";

export function RequestFilters() {
  const router = useRouter();
  const sp = useSearchParams();

  return (
    <select
      aria-label="Estado"
      className={selectClass}
      defaultValue={sp.get("status") ?? ""}
      onChange={(e) => {
        const p = new URLSearchParams(sp.toString());
        if (e.target.value) p.set("status", e.target.value);
        else p.delete("status");
        router.push(`/mantenimiento?${p.toString()}` as Route);
      }}
    >
      <option value="">Todos</option>
      <option value="recibido">Recibido</option>
      <option value="en_proceso">En proceso</option>
      <option value="resuelto">Resuelto</option>
      <option value="cancelado">Cancelado</option>
    </select>
  );
}
