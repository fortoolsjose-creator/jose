import { CircleDot, MessageSquare, Image as ImageIcon, Flag } from "lucide-react";
import type { RequestEventRow } from "@/app/_lib/data/requests";
import type { RequestEventType } from "@/app/_lib/types";

const DT = new Intl.DateTimeFormat("es-MX", {
  day: "2-digit",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
});

const ICON: Record<RequestEventType, typeof CircleDot> = {
  created: Flag,
  status_change: CircleDot,
  comment: MessageSquare,
  photo: ImageIcon,
};

export function RequestTimeline({ events }: { events: RequestEventRow[] }) {
  if (events.length === 0) {
    return <p className="text-muted-foreground text-sm">Sin movimientos todavía.</p>;
  }
  return (
    <ol className="space-y-4">
      {events.map((e) => {
        const Icon = ICON[e.type] ?? CircleDot;
        return (
          <li key={e.id} className="flex gap-3">
            <div className="bg-muted mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full">
              <Icon className="text-muted-foreground size-3.5" />
            </div>
            <div className="min-w-0">
              {e.body && <p className="text-sm">{e.body}</p>}
              {e.photo_signed_url && (
                // eslint-disable-next-line @next/next/no-img-element
                <a href={e.photo_signed_url} target="_blank" rel="noopener noreferrer">
                  <img
                    src={e.photo_signed_url}
                    alt="Foto del reporte"
                    className="mt-1 max-h-48 w-auto rounded-lg border"
                  />
                </a>
              )}
              <p className="text-muted-foreground text-xs">
                {e.actor?.full_name ?? e.actor?.email ?? "Sistema"} ·{" "}
                {DT.format(new Date(e.created_at))}
              </p>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
