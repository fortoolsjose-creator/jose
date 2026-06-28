"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

export function CommentForm({
  action,
  placeholder = "Escribe un mensaje…",
}: {
  action: (input: { body: string }) => Promise<{ ok?: true; error?: string }>;
  placeholder?: string;
}) {
  const [body, setBody] = useState("");
  const [pending, start] = useTransition();
  const router = useRouter();

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (!body.trim()) return;
        start(async () => {
          const r = await action({ body });
          if (r?.error) {
            toast.error(r.error);
            return;
          }
          setBody("");
          router.refresh();
        });
      }}
      className="flex items-end gap-2"
    >
      <Textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        rows={2}
        placeholder={placeholder}
        className="flex-1"
      />
      <Button type="submit" disabled={pending || !body.trim()}>
        Enviar
      </Button>
    </form>
  );
}
