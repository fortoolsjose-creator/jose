"use client";

import type { Route } from "next";
import { useRouter } from "next/navigation";

export function PeriodSelector({ value }: { value: string }) {
  const router = useRouter();
  return (
    <input
      type="month"
      value={value}
      aria-label="Mes del reporte"
      onChange={(e) => {
        const v = e.target.value;
        router.push((v ? `/reportes?periodo=${v}` : "/reportes") as Route);
      }}
      className="border-input focus-visible:border-ring focus-visible:ring-ring/50 h-8 rounded-lg border bg-transparent px-2.5 text-sm outline-none focus-visible:ring-3"
    />
  );
}
