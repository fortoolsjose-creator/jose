"use client";

import type { Route } from "next";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

export type SortOption = { value: string; label: string };

/** Selector "Ordenar por" reutilizable: actualiza ?orden= en la URL. */
export function SortSelect({
  options,
  current,
  param = "orden",
}: {
  options: SortOption[];
  current: string;
  param?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();

  function change(v: string) {
    const params = new URLSearchParams(sp.toString());
    if (v) params.set(param, v);
    else params.delete(param);
    const qs = params.toString();
    router.push((qs ? `${pathname}?${qs}` : pathname) as Route);
  }

  return (
    <label className="flex items-center gap-2 text-sm">
      <span className="text-muted-foreground whitespace-nowrap">Ordenar por</span>
      <select
        value={current}
        onChange={(e) => change(e.target.value)}
        className="border-input focus-visible:border-ring focus-visible:ring-ring/50 h-8 max-w-[15rem] rounded-lg border bg-transparent px-2.5 text-sm outline-none focus-visible:ring-3"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}
