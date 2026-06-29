import { z } from "zod";

const optionalText = z.string().trim().optional().or(z.literal(""));

export const propertySchema = z.object({
  name: z.string().trim().min(1, "Escribe un nombre."),
  type: z.enum(["apartment", "house"]),
  street: optionalText,
  ext_number: optionalText,
  int_number: optionalText,
  colonia: optionalText,
  municipio: optionalText,
  ciudad: optionalText,
  cp: optionalText,
  clabe: optionalText,
  banco: optionalText,
  titular: optionalText,
  entity_id: z.string().uuid().optional().or(z.literal("")),
  notes: optionalText,
  market_value: z.coerce.number().min(0).optional(),
  purchase_price: z.coerce.number().min(0).optional(),
  purchase_date: optionalText,
});
export type PropertyInput = z.infer<typeof propertySchema>;

export const unitSchema = z.object({
  label: z.string().trim().min(1, "Escribe una etiqueta (ej. Depto 1A)."),
  bedrooms: z.coerce.number().int().min(0).max(20).optional(),
  bathrooms: z.coerce.number().min(0).max(20).optional(),
  rent_amount: z.coerce.number().min(0, "No puede ser negativo."),
  deposit_amount: z.coerce.number().min(0, "No puede ser negativo."),
  status: z.enum(["occupied", "vacant", "maintenance"]),
  use_type: z.enum(["residential", "commercial"]),
});
export type UnitInput = z.infer<typeof unitSchema>;

export const expenseSchema = z.object({
  property_id: z.string().uuid("Propiedad no válida.").optional().or(z.literal("")),
  category: z.enum([
    "mantenimiento", "servicios", "predial", "nomina",
    "impuestos", "seguro", "administracion", "otro",
  ]),
  vendor: optionalText,
  description: optionalText,
  amount: z.coerce.number().min(0, "No puede ser negativo."),
  expense_date: z.string().min(1, "Selecciona la fecha."),
  has_invoice: z.boolean().optional(),
});
export type ExpenseInput = z.infer<typeof expenseSchema>;

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

export const leaseSchema = z
  .object({
    unit_id: z.string().uuid("Selecciona una unidad."),
    tenant_full_name: z.string().trim().min(1, "Escribe el nombre del arrendatario."),
    tenant_email: z.string().trim().regex(EMAIL_RE, "Correo no válido."),
    tenant_phone: optionalText,
    start_date: z.string().min(1, "Selecciona la fecha de inicio."),
    end_date: optionalText,
    rent_amount: z.coerce.number().min(0),
    deposit_amount: z.coerce.number().min(0),
    payment_day: z.coerce.number().int().min(1).max(31),
    guarantee_type: z.enum(["aval", "poliza_juridica", "deposito", "otro"]),
    guarantee_notes: optionalText,
    activate: z.boolean().optional(),
    tenant_is_company: z.boolean().optional(),
  });
export type LeaseInput = z.infer<typeof leaseSchema>;

export const requestSchema = z.object({
  title: z.string().trim().min(1, "Describe el problema en pocas palabras."),
  category: z.enum([
    "plomeria",
    "electricidad",
    "cerrajeria",
    "electrodomesticos",
    "limpieza",
    "otro",
  ]),
  description: optionalText,
});
export type RequestInput = z.infer<typeof requestSchema>;

export const commentSchema = z.object({
  body: z.string().trim().min(1, "Escribe un mensaje."),
});
export type CommentInput = z.infer<typeof commentSchema>;

export const listingSchema = z.object({
  unit_id: z.string().uuid("Selecciona una unidad."),
  title: z.string().trim().min(1, "Escribe un título."),
  description: optionalText,
  rent_amount: z.coerce.number().min(0),
  available_from: optionalText,
  requirements: optionalText,
});
export type ListingInput = z.infer<typeof listingSchema>;

export const applicationSchema = z.object({
  listing_id: z.string().uuid(),
  applicant_name: z.string().trim().min(1, "Escribe tu nombre."),
  applicant_phone: optionalText,
  applicant_email: z.string().trim().regex(EMAIL_RE, "Correo no válido."),
  monthly_income: z.coerce.number().min(0).optional(),
  guarantee_type: z.enum(["aval", "poliza_juridica"]),
});
export type ApplicationInput = z.infer<typeof applicationSchema>;
