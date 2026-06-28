"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { setDepositPaid } from "../actions";

export function DepositToggle({
  leaseId,
  paid,
}: {
  leaseId: string;
  paid: boolean;
}) {
  const [pending, start] = useTransition();
  const router = useRouter();
  return (
    <label className="flex cursor-pointer items-center gap-2 text-sm">
      <input
        type="checkbox"
        className="size-4 accent-primary"
        defaultChecked={paid}
        disabled={pending}
        onChange={(e) => {
          const v = e.target.checked;
          start(async () => {
            const r = await setDepositPaid(leaseId, v);
            if (r.error) toast.error(r.error);
            else {
              toast.success("Depósito actualizado");
              router.refresh();
            }
          });
        }}
      />
      Depósito pagado
    </label>
  );
}
