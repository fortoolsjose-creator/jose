"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/app/_lib/supabase/server";
import { newPasswordSchema } from "@/app/_lib/auth-schemas";

export type UpdateState = { error?: string };

export async function updatePassword(
  _prev: UpdateState,
  formData: FormData,
): Promise<UpdateState> {
  const parsed = newPasswordSchema.safeParse({
    password: formData.get("password"),
  });
  if (!parsed.success) {
    return { error: "La contraseña debe tener al menos 8 caracteres." };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({
    password: parsed.data.password,
  });
  if (error) {
    return { error: "No se pudo actualizar. El enlace pudo expirar; pide uno nuevo." };
  }

  redirect("/");
}
