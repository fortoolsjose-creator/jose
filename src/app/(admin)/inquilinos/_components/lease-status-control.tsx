"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import type { LeaseStatus } from "@/app/_lib/types";
import { setLeaseStatus } from "../actions";

const selectClass =
  "flex h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-60";

export function LeaseStatusControl({
  leaseId,
  status,
}: {
  leaseId: string;
  status: LeaseStatus;
}) {
  const [pending, start] = useTransition();
  const router = useRouter();

  return (
    <select
      className={selectClass}
      defaultValue={status}
      disabled={pending}
      onChange={(e) => {
        const next = e.target.value as "active" | "pending" | "ended";
        start(async () => {
          const r = await setLeaseStatus(leaseId, next);
          if (r.error) toast.error(r.error);
          else {
            toast.success("Estado actualizado");
            router.refresh();
          }
        });
      }}
    >
      <option value="active">Activo</option>
      <option value="pending">Pendiente</option>
      <option value="ended">Terminado (inactivo)</option>
    </select>
  );
}
