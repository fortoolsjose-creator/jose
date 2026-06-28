"use client";

import { useTransition } from "react";
import { Bell } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { sendRemindersAction } from "../actions";

export function SendRemindersButton() {
  const [pending, start] = useTransition();
  return (
    <Button
      variant="outline"
      size="sm"
      disabled={pending}
      onClick={() =>
        start(async () => {
          const r = await sendRemindersAction();
          if (r?.error) {
            toast.error(r.error);
            return;
          }
          toast.success(`Recordatorios enviados: ${r.sent ?? 0}`);
        })
      }
    >
      <Bell className="size-4" /> Recordatorios
    </Button>
  );
}
