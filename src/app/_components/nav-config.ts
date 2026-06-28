import {
  Banknote,
  BarChart3,
  BellRing,
  Building2,
  ArrowLeftRight,
  CalendarClock,
  CircleDollarSign,
  ClipboardList,
  FileText,
  HandCoins,
  History,
  Home,
  Landmark,
  LayoutDashboard,
  LineChart,
  ListChecks,
  MapPin,
  Megaphone,
  Receipt,
  Settings,
  TrendingUp,
  Truck,
  UserPlus,
  Users,
  Wrench,
  type LucideIcon,
} from "lucide-react";

export type NavItem = { href: string; label: string; icon: LucideIcon; ownerOnly?: boolean };
// `advanced` = herramientas operativas del día a día (Magaly). En "modo simple"
// (para el dueño) estos grupos se ocultan y queda solo lo esencial del negocio.
export type NavGroup = { title?: string; items: NavItem[]; advanced?: boolean };

// Admin. Esencial (Inicio · Negocio · Ajustes) siempre visible; lo operativo se
// agrupa como "avanzado" y se puede ocultar con el modo simple.
export const ADMIN_NAV: NavGroup[] = [
  { items: [{ href: "/panel", label: "Inicio", icon: LayoutDashboard }] },
  {
    title: "Negocio",
    items: [
      { href: "/propiedades", label: "Propiedades", icon: Building2 },
      { href: "/inquilinos", label: "Inquilinos", icon: Users },
      { href: "/reportes", label: "Reportes", icon: BarChart3 },
    ],
  },
  {
    title: "Operación",
    advanced: true,
    items: [
      { href: "/cobros", label: "Cobros", icon: Banknote },
      { href: "/cuotas", label: "Cuotas", icon: CircleDollarSign },
      { href: "/renovaciones", label: "Renovaciones", icon: CalendarClock },
      { href: "/gastos", label: "Gastos", icon: Receipt },
      { href: "/mantenimiento", label: "Mantenimiento", icon: Wrench },
    ],
  },
  {
    title: "Administración",
    advanced: true,
    items: [
      { href: "/cierre-de-mes", label: "Cierre de mes", icon: ListChecks },
      { href: "/conciliacion", label: "Conciliación", icon: ArrowLeftRight },
      { href: "/nomina", label: "Nómina", icon: HandCoins },
      { href: "/proveedores", label: "Proveedores", icon: Truck },
      { href: "/anuncios", label: "Avisos", icon: BellRing },
      { href: "/entidades", label: "Sociedades", icon: Landmark, ownerOnly: true },
      { href: "/bitacora", label: "Bitácora", icon: History, ownerOnly: true },
    ],
  },
  {
    title: "Captación",
    advanced: true,
    items: [
      { href: "/prospectos", label: "Prospectos", icon: UserPlus },
      { href: "/vacantes", label: "Vacantes", icon: Megaphone },
      { href: "/solicitudes", label: "Solicitudes", icon: ClipboardList },
    ],
  },
  {
    title: "Análisis",
    advanced: true,
    items: [
      { href: "/rentabilidad", label: "Rentabilidad", icon: LineChart, ownerOnly: true },
      { href: "/rentabilidad-region", label: "Por región", icon: MapPin, ownerOnly: true },
      { href: "/rentabilidad-sociedad", label: "Por sociedad", icon: Landmark, ownerOnly: true },
      { href: "/estudio-mercado", label: "Estudio de mercado", icon: TrendingUp },
    ],
  },
  { items: [{ href: "/ajustes", label: "Ajustes", icon: Settings }] },
];

// Tenant (inquilino) — corto y simple a propósito (un solo grupo, sin títulos).
export const TENANT_NAV: NavGroup[] = [
  {
    items: [
      { href: "/inicio", label: "Inicio", icon: Home },
      { href: "/mi-renta", label: "Mi renta", icon: Banknote },
      { href: "/mis-reportes", label: "Mis reportes", icon: Wrench },
      { href: "/mi-contrato", label: "Mi contrato", icon: FileText },
    ],
  },
];
