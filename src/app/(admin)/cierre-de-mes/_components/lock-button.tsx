"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Lock, Unlock } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { lockPeriod, unlockPeriod } from "../actions";

export function LockButton({
  period,
  locked,
  isOwner,
}: {
  period: string;
  locked: boolean;
  isOwner: boolean;
}) {
  const [pending, start] = useTransition();
  const router = useRouter();

  function toggle() {
    start(async () => {
      const r = locked ? await unlockPeriod(period) : await lockPeriod(period);
      if (r.error) {
        toast.error(r.error);
        return;
      }
      toast.success(locked ? "Mes reabierto" : "Mes cerrado");
      router.refresh();
    });
  }

  if (locked && !isOwner) {
    return <span className="text-muted-foreground text-sm">Mes cerrado por el dueño.</span>;
  }

  return (
    <Button size="sm" variant="outline" disabled={pending} onClick={toggle}>
      {locked ? <Unlock className="size-4" /> : <Lock className="size-4" />}
      {locked ? "Reabrir mes" : "Cerrar mes"}
    </Button>
  );
}
