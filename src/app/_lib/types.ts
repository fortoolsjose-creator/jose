// Domain types + Spanish labels for the Llave schema.

export type UserRole = "owner" | "staff" | "tenant";
export type PropertyType = "apartment" | "house";
export type UnitStatus = "occupied" | "vacant" | "maintenance";
export type GuaranteeType = "aval" | "poliza_juridica" | "deposito" | "otro";
export type LeaseStatus = "active" | "ended" | "pending";
export type PaymentMethod = "spei" | "oxxo" | "cash" | "card" | "other";
export type PaymentStatus = "pending" | "partial" | "paid" | "overdue";
export type MaintenanceCategory =
  | "plomeria" | "electricidad" | "cerrajeria"
  | "electrodomesticos" | "limpieza" | "otro";
export type MaintenancePriority = "baja" | "media" | "alta" | "urgente";
export type MaintenanceStatus = "recibido" | "en_proceso" | "resuelto" | "cancelado";
export type MaintenanceType = "correctivo" | "preventivo";
export type RequestEventType = "created" | "status_change" | "comment" | "photo";
export type ListingStatus = "draft" | "published" | "paused" | "filled";
export type ApplicationStatus = "recibida" | "en_revision" | "aprobada" | "rechazada";

export type Property = {
  id: string;
  org_id: string;
  name: string;
  type: PropertyType;
  street: string | null;
  ext_number: string | null;
  int_number: string | null;
  colonia: string | null;
  municipio: string | null;
  ciudad: string | null;
  cp: string | null;
  entity_id: string | null;
  clabe: string | null;
  banco: string | null;
  titular: string | null;
  notes: string | null;
  market_value: number | null;
  purchase_price: number | null;
  purchase_date: string | null;
  maintenance_fund_opening: number;
  maintenance_fund_opening_note: string | null;
  operating_fund_opening: number;
  operating_fund_opening_note: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
};

export type Unit = {
  id: string;
  org_id: string;
  property_id: string;
  label: string;
  m2: number | null;
  bedrooms: number | null;
  bathrooms: number | null;
  rent_amount: number;
  deposit_amount: number;
  status: UnitStatus;
  use_type: UnitUse;
  rent_market_min: number | null;
  rent_market_avg: number | null;
  rent_market_max: number | null;
  rent_market_source: string | null;
  rent_market_updated_at: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
};

export type Lease = {
  id: string;
  org_id: string;
  unit_id: string;
  tenant_profile_id: string | null;
  start_date: string | null;
  end_date: string | null;
  rent_amount: number;
  deposit_amount: number;
  payment_day: number;
  guarantee_type: GuaranteeType | null;
  guarantee_notes: string | null;
  status: LeaseStatus;
  contract_doc_url: string | null;
  tenant_is_company: boolean;
  deposit_paid: boolean;
  parking_fee: number;
  furniture_fee: number;
  garantia_monto: number | null;
  poliza_vigencia: string | null;
  pagare_referencia: string | null;
  acta_entrega_path: string | null;
  acta_vencimiento_path: string | null;
  annual_increase_pct: number | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
};

export type LegalEntity = {
  id: string;
  org_id: string;
  nombre: string;
  rfc: string | null;
  regimen: string | null;
  created_at: string;
  deleted_at: string | null;
};

export type Announcement = {
  id: string;
  org_id: string;
  property_id: string | null;
  title: string;
  body: string | null;
  until: string | null;
  created_at: string;
  deleted_at: string | null;
};

export type LeaseRenewal = {
  id: string;
  org_id: string;
  lease_id: string;
  previous_rent: number;
  new_rent: number;
  increase_pct: number | null;
  previous_end: string | null;
  new_end: string | null;
  note: string | null;
  created_by: string | null;
  created_at: string;
};

export type Payment = {
  id: string;
  org_id: string;
  lease_id: string;
  period_month: string;
  amount_due: number;
  amount_paid: number;
  due_date: string | null;
  paid_date: string | null;
  method: PaymentMethod | null;
  reference: string | null;
  status: PaymentStatus;
  receipt_pdf_url: string | null;
  cfdi_id: string | null;
  fiscal_status: FiscalStatus;
  invoiced_at: string | null;
  subtotal: number | null;
  iva: number | null;
  retencion_isr: number | null;
  retencion_iva: number | null;
  confirmed_by: string | null;
  tenant_reference: string | null;
  tenant_marked_paid_at: string | null;
  proof_path: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
};

export type MaintenanceRequest = {
  id: string;
  org_id: string;
  unit_id: string | null;
  lease_id: string | null;
  created_by: string | null;
  title: string;
  description: string | null;
  category: MaintenanceCategory;
  priority: MaintenancePriority;
  status: MaintenanceStatus;
  assigned_to: string | null;
  worker_id: string | null;
  cost: number | null;
  resolved_at: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
};

export type RequestEvent = {
  id: string;
  org_id: string;
  request_id: string;
  actor_id: string | null;
  type: RequestEventType;
  body: string | null;
  photo_url: string | null;
  created_at: string;
};

export type Profile = {
  id: string;
  org_id: string;
  role: UserRole;
  full_name: string | null;
  phone: string | null;
  email: string | null;
  whatsapp_opt_in: boolean;
  rfc: string | null;
  razon_social: string | null;
  regimen_fiscal: string | null;
  uso_cfdi: string | null;
  requiere_factura: boolean;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
};

export type FiscalStatus = "con_factura" | "sin_factura" | "pendiente";

export type Listing = {
  id: string;
  org_id: string;
  unit_id: string;
  title: string;
  description: string | null;
  rent_amount: number;
  available_from: string | null;
  photos: string[];
  requirements: string | null;
  status: ListingStatus;
  public_slug: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
};

export type Application = {
  id: string;
  org_id: string;
  listing_id: string;
  applicant_name: string;
  applicant_phone: string | null;
  applicant_email: string | null;
  monthly_income: number | null;
  income_proof_url: string | null;
  id_doc_url: string | null;
  guarantee_type: GuaranteeType | null;
  guarantee_doc_url: string | null;
  status: ApplicationStatus;
  notes: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
};

export type UnitUse = "residential" | "commercial";
export type ExpenseCategory =
  | "mantenimiento" | "servicios" | "predial" | "nomina"
  | "impuestos" | "seguro" | "administracion" | "otro";

export type Expense = {
  id: string;
  org_id: string;
  property_id: string | null;
  category: ExpenseCategory;
  vendor: string | null;
  description: string | null;
  amount: number;
  expense_date: string;
  period_month: string | null;
  method: PaymentMethod | null;
  has_invoice: boolean;
  notes: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
};

export type Provider = {
  id: string;
  org_id: string;
  name: string;
  service_type: string | null;
  phone: string | null;
  email: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
};

export type Worker = {
  id: string;
  org_id: string;
  name: string;
  role: string | null;
  pay_frequency: string | null;
  base_pay: number | null;
  active: boolean;
  notes: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
};

export type PayrollPayment = {
  id: string;
  org_id: string;
  worker_id: string;
  period_month: string;
  amount: number;
  paid_date: string | null;
  method: PaymentMethod | null;
  acuse_path: string | null;
  notes: string | null;
  created_at: string;
};

export type ProspectStage =
  | "prospecto" | "evaluacion" | "aprobado" | "rechazado" | "papeleo" | "cliente";

export type Prospect = {
  id: string;
  org_id: string;
  name: string;
  is_company: boolean;
  contact_phone: string | null;
  contact_email: string | null;
  property_id: string | null;
  unit_id: string | null;
  giro: string | null;
  impacto: string | null;
  monthly_income: number | null;
  rent_target: number | null;
  guarantee_type: GuaranteeType | null;
  stage: ProspectStage;
  contrato_ok: boolean;
  pagare_ok: boolean;
  garantia_ok: boolean;
  acta_ok: boolean;
  notes: string | null;
  lease_id: string | null;
  converted_at: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
};

export const PROSPECT_STAGE_LABELS: Record<ProspectStage, string> = {
  prospecto: "Prospecto",
  evaluacion: "En evaluación",
  aprobado: "Aprobado",
  rechazado: "Rechazado",
  papeleo: "Papeleo",
  cliente: "Cliente",
};

// --- Spanish labels for UI ---
export const PROPERTY_TYPE_LABELS: Record<PropertyType, string> = {
  apartment: "Departamento",
  house: "Casa",
};
export const UNIT_STATUS_LABELS: Record<UnitStatus, string> = {
  occupied: "Ocupada",
  vacant: "Disponible",
  maintenance: "Mantenimiento",
};
export const LEASE_STATUS_LABELS: Record<LeaseStatus, string> = {
  active: "Activo",
  ended: "Terminado",
  pending: "Pendiente",
};
export const GUARANTEE_TYPE_LABELS: Record<GuaranteeType, string> = {
  aval: "Aval",
  poliza_juridica: "Póliza jurídica",
  deposito: "Depósito",
  otro: "Otro",
};
export const PAYMENT_STATUS_LABELS: Record<PaymentStatus, string> = {
  pending: "Pendiente",
  partial: "Parcial",
  paid: "Pagado",
  overdue: "Vencido",
};
export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  spei: "SPEI",
  oxxo: "OXXO",
  cash: "Efectivo",
  card: "Tarjeta",
  other: "Otro",
};
export const FISCAL_STATUS_LABELS: Record<FiscalStatus, string> = {
  con_factura: "Con factura",
  sin_factura: "Sin factura",
  pendiente: "Factura pendiente",
};
export const MAINTENANCE_CATEGORY_LABELS: Record<MaintenanceCategory, string> = {
  plomeria: "Plomería",
  electricidad: "Electricidad",
  cerrajeria: "Cerrajería",
  electrodomesticos: "Electrodomésticos",
  limpieza: "Limpieza",
  otro: "Otro",
};
export const MAINTENANCE_PRIORITY_LABELS: Record<MaintenancePriority, string> = {
  baja: "Baja",
  media: "Media",
  alta: "Alta",
  urgente: "Urgente",
};
export const MAINTENANCE_STATUS_LABELS: Record<MaintenanceStatus, string> = {
  recibido: "Recibido",
  en_proceso: "En proceso",
  resuelto: "Resuelto",
  cancelado: "Cancelado",
};
export const MAINTENANCE_TYPE_LABELS: Record<MaintenanceType, string> = {
  correctivo: "Correctivo",
  preventivo: "Preventivo",
};
export const LISTING_STATUS_LABELS: Record<ListingStatus, string> = {
  draft: "Borrador",
  published: "Publicada",
  paused: "Pausada",
  filled: "Ocupada",
};
export const APPLICATION_STATUS_LABELS: Record<ApplicationStatus, string> = {
  recibida: "Recibida",
  en_revision: "En revisión",
  aprobada: "Aprobada",
  rechazada: "Rechazada",
};
export const UNIT_USE_LABELS: Record<UnitUse, string> = {
  residential: "Residencial",
  commercial: "Comercial",
};
export const EXPENSE_CATEGORY_LABELS: Record<ExpenseCategory, string> = {
  mantenimiento: "Mantenimiento",
  servicios: "Servicios",
  predial: "Predial",
  nomina: "Nómina",
  impuestos: "Impuestos",
  seguro: "Seguro",
  administracion: "Administración",
  otro: "Otro",
};

// --- Expediente (documentos) ---
export type DocumentOwnerType = "profile" | "property" | "unit" | "lease";

export const DOCUMENT_KIND_LABELS: Record<string, string> = {
  ine: "INE / Identificación",
  comprobante_ingresos: "Comprobante de ingresos",
  comprobante_domicilio: "Comprobante de domicilio",
  rfc_csf: "RFC / Constancia de situación fiscal",
  contrato_firmado: "Contrato firmado",
  aval_documento: "Documento del aval",
  referencias: "Referencias",
  foto_propiedad: "Foto",
  escritura: "Escritura",
  predial: "Boleta predial",
  poliza_seguro: "Póliza de seguro",
  plano: "Plano",
  avaluo: "Avalúo",
  otro: "Otro",
};

// Checklist de "qué debería tener" cada expediente.
export const TENANT_DOC_KINDS = [
  "ine",
  "comprobante_ingresos",
  "comprobante_domicilio",
  "rfc_csf",
  "contrato_firmado",
  "aval_documento",
] as const;

export const PROPERTY_DOC_KINDS = [
  "foto_propiedad",
  "escritura",
  "predial",
  "poliza_seguro",
  "plano",
] as const;
