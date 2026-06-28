"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/app/_lib/supabase/server";
import {
  emailLoginSchema,
  otpSchema,
  normalizeMxPhone,
} from "@/app/_lib/auth-schemas";

export type EmailState = { error?: string };
export type PhoneState = { error?: string; sent?: boolean; phone?: string };

export async function signInWithPassword(
  _prev: EmailState,
  formData: FormData,
): Promise<EmailState> {
  const parsed = emailLoginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) return { error: "Revisa tu correo y contraseña." };

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) return { error: "Correo o contraseña incorrectos." };

  redirect("/");
}

export async function sendPhoneOtp(
  _prev: PhoneState,
  formData: FormData,
): Promise<PhoneState> {
  const phone = normalizeMxPhone(String(formData.get("phone") ?? ""));
  if (!phone) return { error: "Número no válido. Escribe 10 dígitos." };

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithOtp({ phone });
  if (error) return { error: "No pudimos enviar el código. Revisa el número." };

  return { sent: true, phone };
}

export async function verifyPhoneOtp(
  _prev: PhoneState,
  formData: FormData,
): Promise<PhoneState> {
  const phone = String(formData.get("phone") ?? "");
  const code = String(formData.get("code") ?? "");
  const parsed = otpSchema.safeParse({ phone, code });
  if (!parsed.success) return { error: "Código no válido.", sent: true, phone };

  const supabase = await createClient();
  const { error } = await supabase.auth.verifyOtp({
    phone,
    token: code,
    type: "sms",
  });
  if (error) return { error: "Código incorrecto o expirado.", sent: true, phone };

  redirect("/");
}
