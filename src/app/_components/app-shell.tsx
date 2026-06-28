"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { Route } from "next";
import { usePathname } from "next/navigation";
import { List, Menu, Sparkles } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ADMIN_NAV, TENANT_NAV, type NavGroup } from "./nav-config";
import { SignOutButton } from "./sign-out-button";
import { Logo } from "./logo";

function NavLinks({
  groups,
  onNavigate,
}: {
  groups: NavGroup[];
  onNavigate?: () => void;
}) {
  const pathname = usePathname();
  return (
    <nav className="flex flex-col gap-4">
      {groups.map((group, gi) => (
        <div key={group.title ?? `g${gi}`} className="flex flex-col gap-1">
          {group.title && (
            <p className="text-muted-foreground px-3 pb-1 text-[10px] font-semibold tracking-wider uppercase">
              {group.title}
            </p>
          )}
          {group.items.map((item) => {
            const active =
              pathname === item.href || pathname.startsWith(item.href + "/");
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href as Route}
                onClick={onNavigate}
                className={cn(
                  "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                  active
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground",
                )}
              >
                <Icon className="size-4 shrink-0" />
                {item.label}
              </Link>
            );
          })}
        </div>
      ))}
    </nav>
  );
}

function SimpleToggle({ simple, onToggle }: { simple: boolean; onToggle: () => void }) {
  return (
    <button
      onClick={onToggle}
      className="text-muted-foreground hover:bg-muted hover:text-foreground mb-1 flex w-full items-center gap-2 rounded-md px-3 py-2 text-xs font-medium transition-colors"
    >
      {simple ? <List className="size-4 shrink-0" /> : <Sparkles className="size-4 shrink-0" />}
      {simple ? "Mostrar todo el menú" : "Modo simple"}
    </button>
  );
}

export function AppShell({
  variant,
  userLabel,
  isOwner = false,
  children,
}: {
  variant: "admin" | "tenant";
  userLabel?: string;
  isOwner?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  // Modo simple: oculta los grupos "avanzados" (operación). Es SOLO para dueños
  // (Genaro/Adri) — arrancan en simple y ellos eligen "Mostrar todo". La
  // asistente (staff) siempre ve el menú completo. Se guarda por dispositivo.
  const [simple, setSimple] = useState(true);
  useEffect(() => {
    const v = localStorage.getItem("llave:nav-simple");
    if (v !== null) setSimple(v === "1");
  }, []);
  const toggleSimple = () =>
    setSimple((s) => {
      const next = !s;
      localStorage.setItem("llave:nav-simple", next ? "1" : "0");
      return next;
    });

  const isAdmin = variant === "admin";
  // El modo simple solo aplica a dueños; la asistente (staff) ve todo siempre.
  const canSimplify = isAdmin && isOwner;
  const base = isAdmin ? ADMIN_NAV : TENANT_NAV;
  const groups = (canSimplify && simple ? base.filter((g) => !g.advanced) : base)
    .map((g) => ({ ...g, items: g.items.filter((it) => isOwner || !it.ownerOnly) }))
    .filter((g) => g.items.length > 0);
  const homeHref = (isAdmin ? "/panel" : "/inicio") as Route;

  return (
    <div className="flex min-h-dvh flex-1">
      <a
        href="#main"
        className="sr-only focus:bg-primary focus:text-primary-foreground focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:rounded-md focus:px-3 focus:py-2 focus:not-sr-only"
      >
        Saltar al contenido
      </a>
      {/* Desktop sidebar */}
      <aside className="bg-card hidden w-60 shrink-0 flex-col border-r p-4 md:sticky md:top-0 md:flex md:h-dvh">
        <Link href={homeHref} aria-label="Ir al inicio" className="mb-6 block px-3">
          <Logo className="h-7 w-auto" />
        </Link>
        <div className="-mx-1 min-h-0 flex-1 overflow-y-auto px-1">
          <NavLinks groups={groups} />
        </div>
        <div className="mt-auto border-t pt-3">
          {canSimplify && <SimpleToggle simple={simple} onToggle={toggleSimple} />}
          {userLabel && (
            <p className="text-muted-foreground truncate px-3 pb-2 text-xs">
              {userLabel}
            </p>
          )}
          <SignOutButton />
        </div>
      </aside>

      {/* Main column */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Mobile top bar */}
        <header className="flex items-center gap-2 border-b p-3 md:hidden">
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger
              render={
                <Button variant="ghost" size="icon" aria-label="Abrir menú" />
              }
            >
              <Menu className="size-5" />
            </SheetTrigger>
            <SheetContent side="left" className="flex w-64 flex-col overflow-y-auto p-4">
              <SheetHeader className="px-1">
                <SheetTitle>
                  <Link href={homeHref} onClick={() => setOpen(false)} aria-label="Ir al inicio">
                    <Logo className="h-6 w-auto" />
                  </Link>
                </SheetTitle>
              </SheetHeader>
              <div className="mt-4">
                <NavLinks groups={groups} onNavigate={() => setOpen(false)} />
              </div>
              <div className="mt-6 border-t pt-3">
                {canSimplify && <SimpleToggle simple={simple} onToggle={toggleSimple} />}
                {userLabel && (
                  <p className="text-muted-foreground truncate px-3 pb-2 text-xs">
                    {userLabel}
                  </p>
                )}
                <SignOutButton />
              </div>
            </SheetContent>
          </Sheet>
          <Link href={homeHref} aria-label="Ir al inicio">
            <Logo className="h-6 w-auto" />
          </Link>
        </header>

        <main id="main" className="flex-1 p-4 md:p-8">
          {children}
        </main>
      </div>
    </div>
  );
}
