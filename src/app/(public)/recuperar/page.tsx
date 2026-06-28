import type { Metadata } from "next";
import Link from "next/link";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { RecoverForm } from "./recover-form";

export const metadata: Metadata = { title: "Recuperar contraseña" };

export default function RecuperarPage() {
  return (
    <Card className="w-full max-w-sm">
      <CardHeader className="text-center">
        <CardTitle className="text-2xl">Recuperar contraseña</CardTitle>
        <CardDescription>Te enviaremos un enlace a tu correo.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <RecoverForm />
        <p className="text-center text-sm">
          <Link href="/login" className="underline underline-offset-4">
            Volver a iniciar sesión
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}
