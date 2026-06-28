import { redirect } from "next/navigation";
import { getProfile } from "@/app/_lib/dal";
import { AppShell } from "@/app/_components/app-shell";

export default async function TenantLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const profile = await getProfile();
  if (!profile) redirect("/login");
  if (profile.role === "owner" || profile.role === "staff") redirect("/panel");

  return (
    <AppShell
      variant="tenant"
      userLabel={profile.full_name ?? profile.email ?? undefined}
    >
      {children}
    </AppShell>
  );
}
