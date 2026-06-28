// Verifica (y si hace falta, pone público) el bucket listing-photos.
// Correr: node --env-file=.env.local scripts/check-bucket.mjs
import { createClient } from "@supabase/supabase-js";
const a = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});
// SOLO LECTURA: no cambia nada, solo reporta el estado.
const { data, error } = await a.storage.getBucket("listing-photos");
if (error) { console.log("Error leyendo bucket:", error.message); process.exit(1); }
console.log("listing-photos -> public:", data.public);
console.log(
  data.public
    ? "✅ Ya está público. Las fotos de anuncios cargarán bien."
    : "⚠️ Está PRIVADO. Hay que ponerlo público en el dashboard de Supabase para que carguen las fotos.",
);
