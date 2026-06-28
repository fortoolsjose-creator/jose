"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Star } from "lucide-react";
import { toast } from "sonner";
import { submitRating } from "../actions";

export function TenantRating({ requestId }: { requestId: string }) {
  const [hover, setHover] = useState(0);
  const [value, setValue] = useState(0);
  const [pending, start] = useTransition();
  const router = useRouter();

  function pick(n: number) {
    setValue(n);
    start(async () => {
      const r = await submitRating(requestId, n);
      if (r.error) {
        toast.error(r.error);
        setValue(0);
        return;
      }
      toast.success("¡Gracias por tu opinión!");
      router.refresh();
    });
  }

  return (
    <div className="bg-muted/40 rounded-lg border p-4">
      <p className="mb-2 text-sm font-medium">¿Qué tal quedó el servicio?</p>
      <div className="flex gap-1">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            disabled={pending}
            onMouseEnter={() => setHover(n)}
            onMouseLeave={() => setHover(0)}
            onClick={() => pick(n)}
            aria-label={`${n} de 5`}
          >
            <Star
              className={`size-7 transition ${
                n <= (hover || value)
                  ? "fill-amber-400 text-amber-400"
                  : "text-muted-foreground"
              }`}
            />
          </button>
        ))}
      </div>
    </div>
  );
}
