
"use client";

import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';
import { Header } from '@/components/layout/header';
import { MainWrapper } from '@/components/layout/main-wrapper';
import { SoundPlayer } from '@/components/audio/sound-player';

export function PageShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  // Check if the current page is one of the isolated mobile views
  const isIsolatedMobilePage = pathname === '/mobile' || pathname.startsWith('/mobile-controls') || pathname.startsWith('/nutri') || pathname === '/acceso-restringido';
  const isReadOnly = process.env.NEXT_PUBLIC_READ_ONLY === 'true';

  if (isIsolatedMobilePage) {
    // For mobile pages, provide a simple main wrapper without the header and sound
    return (
      <main className="w-full h-full bg-background">
        {children}
      </main>
    );
  }

  // For all other pages, render the standard layout with Header and MainWrapper
  return (
    <>
      <SoundPlayer />
      {!isReadOnly && <Header />}
      <MainWrapper>
        {children}
      </MainWrapper>
    </>
  );
}
