"use client";

import type { Route } from "next";
import { useRouter, useSearchParams } from "next/navigation";

const selectClass =
  "flex h-8 rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50";

export function ExpenseFilters({
  months,
  properties,
}: {
  months: { value: string; label: string }[];
  properties: { id: string; name: string }[];
}) {
  const router = useRouter();
  const sp = useSearchParams();

  function set(key: string, value: string) {
    const p = new URLSearchParams(sp.toString());
    if (value) p.set(key, value);
    else p.delete(key);
    router.push(`/gastos?${p.toString()}` as Route);
  }

  return (
    <div className="flex flex-wrap gap-2">
      <select
        aria-label="Mes"
        className={selectClass}
        defaultValue={sp.get("month") ?? ""}
        onChange={(e) => set("month", e.target.value)}
      >
        <option value="">Todos los meses</option>
        {months.map((m) => (
          <option key={m.value} value={m.value}>{m.label}</option>
        ))}
      </select>
      <select
        aria-label="Edificio"
        className={selectClass}
        defaultValue={sp.get("property") ?? ""}
        onChange={(e) => set("property", e.target.value)}
      >
        <option value="">Todos los edificios</option>
        {properties.map((p) => (
          <option key={p.id} value={p.id}>{p.name}</option>
        ))}
      </select>
    </div>
  );
}
