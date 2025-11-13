"use client";

import { usePathname } from 'next/navigation';
import { Toaster } from "@/components/ui/toaster";

export function ConditionalToaster() {
  const pathname = usePathname();

  // No mostrar toasts en las rutas donde se muestra el scoreboard
  if (pathname === '/' || pathname === '/scoreboard') {
    return null;
  }

  return <Toaster />;
}
