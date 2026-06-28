import Link from "next/link";
import { redirect } from "next/navigation";
import { getUser, getProfile } from "@/app/_lib/dal";
import { buttonVariants } from "@/components/ui/button";
import { Logo } from "@/app/_components/logo";

export default async function Home() {
  const user = await getUser();
  if (user) {
    const profile = await getProfile();
    redirect(profile?.role === "tenant" ? "/inicio" : "/panel");
  }

  return (
    <div className="mx-auto flex max-w-md flex-col items-center gap-8 text-center">
      <div className="space-y-3">
        <Logo className="mx-auto h-14 w-auto" />
        <p className="text-muted-foreground text-balance text-lg">
          Bienestar y crecimiento empresarial en un solo lugar
        </p>
      </div>
      <Link href="/login" className={buttonVariants({ size: "lg" })}>
        Iniciar sesión
      </Link>
    </div>
  );
}
