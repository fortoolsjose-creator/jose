// Logo de Metros Redondos (marca del cliente). PNG con fondo transparente,
// así que se ve bien sobre cualquier superficie. Wordmark horizontal ~10:1,
// por eso siempre se dimensiona por altura (h-*) dejando el ancho automático.
export function Logo({ className }: { className?: string }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src="/metros-redondos-logo.png"
      alt="Metros Redondos"
      className={className}
    />
  );
}
