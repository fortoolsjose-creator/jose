"use client";

import { useEffect } from "react";
import { ErrorScreen } from "@/app/_components/error-screen";

export default function TenantError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);
  return <ErrorScreen reset={reset} homeHref="/inicio" />;
}
