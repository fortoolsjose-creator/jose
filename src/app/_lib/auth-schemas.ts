import { z } from "zod";

// Plain regex avoids depending on zod's email() API across versions.
const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

export const emailLoginSchema = z.object({
  email: z.string().regex(EMAIL_RE, "Correo no válido."),
  password: z.string().min(1, "Escribe tu contraseña."),
});

export const emailOnlySchema = z.object({
  email: z.string().regex(EMAIL_RE, "Correo no válido."),
});

export const otpSchema = z.object({
  phone: z.string().min(8),
  code: z.string().min(4, "Código no válido."),
});

export const newPasswordSchema = z.object({
  password: z.string().min(8, "La contraseña debe tener al menos 8 caracteres."),
});

/** Normalize a Mexican phone number to E.164 (+52XXXXXXXXXX). Returns null if invalid. */
export function normalizeMxPhone(raw: string): string | null {
  const digits = raw.replace(/\D/g, "");
  if (raw.trim().startsWith("+") && digits.length >= 11) return `+${digits}`;
  if (digits.length === 10) return `+52${digits}`;
  if (digits.length === 12 && digits.startsWith("52")) return `+${digits}`;
  return null;
}
