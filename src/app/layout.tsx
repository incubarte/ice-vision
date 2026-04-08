
import type { Metadata } from 'next';
import './globals.css';
import { GameStateProvider } from '@/contexts/game-state-context';
import { ConditionalToaster } from "@/components/ui/conditional-toaster";
import { cn } from '@/lib/utils';
import { PageShell } from '@/components/layout/page-shell';
import { Analytics } from "@vercel/analytics/next";

export const metadata: Metadata = {
  title: 'IceVision - Hockey Scoreboard',
  description: 'Ice hockey game dashboard with real-time scores, clock, and penalty tracking.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@300..700&display=swap" rel="stylesheet" />
        <link rel="manifest" href="/manifest.json" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=0, viewport-fit=cover" />
      </head>
      <body className={cn("min-h-screen bg-background font-body antialiased")}>
        <GameStateProvider>
          <PageShell>{children}</PageShell>
          <ConditionalToaster />
        </GameStateProvider>
        <Analytics />
        <script
          dangerouslySetInnerHTML={{
            __html: `
              if ('serviceWorker' in navigator) {
                window.addEventListener('load', function() {
                  navigator.serviceWorker.register('/sw.js').then(function(reg) {
                    console.log('SW registered');
                  }).catch(function(err) {
                    console.error('SW failed', err);
                  });
                });
              }
            `,
          }}
        />
      </body>
    </html>
  );
}
