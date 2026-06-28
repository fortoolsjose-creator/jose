"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { PROCESSES, PROCESS_GROUPS } from "@/app/_lib/processes";
import { toggleProcess } from "../actions";

export function ProcessChecklist({ period, done }: { period: string; done: number[] }) {
  const [doneSet, setDoneSet] = useState<Set<number>>(new Set(done));
  const [pending, start] = useTransition();

  function toggle(no: number) {
    const next = !doneSet.has(no);
    const apply = (add: boolean) =>
      setDoneSet((prev) => {
        const s = new Set(prev);
        if (add) s.add(no);
        else s.delete(no);
        return s;
      });
    apply(next); // optimista
    start(async () => {
      try {
        const res = await toggleProcess(no, period, next);
        if (res?.error) {
          apply(!next); // revierte
          toast.error(res.error);
        }
      } catch {
        apply(!next); // revierte ante fallo de red
        toast.error("No se pudo guardar. Revisa tu conexión.");
      }
    });
  }

  return (
    <div className="space-y-6">
      {PROCESS_GROUPS.map((g) => {
        const items = PROCESSES.filter((p) => p.group === g);
        if (items.length === 0) return null;
        const gd = items.filter((p) => doneSet.has(p.no)).length;
        return (
          <div key={g}>
            <h3 className="text-muted-foreground mb-2 text-xs font-semibold uppercase">
              {g} · {gd}/{items.length}
            </h3>
            <div className="divide-y rounded-lg border">
              {items.map((p) => {
                const isDone = doneSet.has(p.no);
                return (
                  <label
                    key={p.no}
                    className="flex cursor-pointer items-center gap-3 px-4 py-2.5 text-sm"
                  >
                    <input
                      type="checkbox"
                      checked={isDone}
                      onChange={() => toggle(p.no)}
                      disabled={pending}
                      className="size-4 shrink-0"
                    />
                    <span className={isDone ? "text-muted-foreground line-through" : ""}>
                      {p.no}. {p.name}
                    </span>
                    <span className="text-muted-foreground ml-auto shrink-0 text-xs">{p.freq}</span>
                  </label>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
