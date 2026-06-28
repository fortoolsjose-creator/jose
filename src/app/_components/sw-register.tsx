"use client";

import { useEffect } from "react";

/** Registra el service worker (PWA: instalable + arranque rápido + página offline). */
export function SwRegister() {
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {
        // best-effort: si el navegador no lo soporta, la app sigue funcionando online
      });
    }
  }, []);
  return null;
}
