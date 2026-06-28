import { redirect } from "next/navigation";
import { getProfile } from "@/app/_lib/dal";
import { AppShell } from "@/app/_components/app-shell";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const profile = await getProfile();
  if (!profile) redirect("/login");
  if (profile.role === "tenant") redirect("/inicio");

  return (
    <AppShell
      variant="admin"
      userLabel={profile.full_name ?? profile.email ?? undefined}
      isOwner={profile.role === "owner"}
    >
      {children}
    </AppShell>
  );
}
