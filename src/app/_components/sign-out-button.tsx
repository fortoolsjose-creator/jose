"use client";

import { LogOut } from "lucide-react";
import { signOut } from "@/app/_lib/auth-actions";
import { Button } from "@/components/ui/button";

export function SignOutButton() {
  return (
    <form action={signOut}>
      <Button type="submit" variant="ghost" size="sm" className="gap-2">
        <LogOut className="size-4" />
        <span>Salir</span>
      </Button>
    </form>
  );
}
