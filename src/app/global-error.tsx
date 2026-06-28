"use client";

import { useEffect } from "react";

// Captura errores que ocurren en el layout raíz (reemplaza todo el documento).
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);
  return (
    <html lang="es-MX">
      <body
        style={{
          fontFamily: "system-ui, -apple-system, sans-serif",
          display: "flex",
          minHeight: "100dvh",
          alignItems: "center",
          justifyContent: "center",
          padding: "2rem",
          textAlign: "center",
          margin: 0,
        }}
      >
        <div>
          <h1 style={{ fontSize: "1.25rem", fontWeight: 600, margin: 0 }}>
            Algo salió mal
          </h1>
          <p style={{ color: "#6b7280", marginTop: "0.5rem" }}>
            Tuvimos un problema al cargar la aplicación. Vuelve a intentar.
          </p>
          <button
            onClick={() => reset()}
            style={{
              marginTop: "1.25rem",
              padding: "0.5rem 1.25rem",
              borderRadius: "9999px",
              background: "#e06603",
              color: "white",
              border: 0,
              cursor: "pointer",
              fontSize: "0.875rem",
            }}
          >
            Reintentar
          </button>
        </div>
      </body>
    </html>
  );
}
