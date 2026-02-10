import type { Metadata, Viewport } from 'next';
import Script from 'next/script';
import type { ReactNode } from 'react';

import './globals.css';

const stagingBadgeScript = `
(function showStagingBadge() {
  var host = window.location.hostname.toLowerCase();
  var isStagingHost = host.includes('staging') || host.includes('preprod');
  if (!isStagingHost) {
    return;
  }
  var badge = document.getElementById('environment-badge');
  if (badge) {
    badge.classList.remove('hidden');
  }
})();
`;

export const metadata: Metadata = {
  title: 'Evolve Sprouts',
  description: 'Evolve Sprouts public website.',
  icons: {
    icon: '/favicon.ico',
    shortcut: '/favicon.ico',
  },
  robots: {
    index: true,
    follow: true,
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <html lang='en'>
      <body className='antialiased'>
        <div
          id='environment-badge'
          className='pointer-events-none fixed right-4 top-4 z-50 hidden rounded-md bg-amber-500 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-white shadow-md'
        >
          Staging
        </div>
        <Script id='show-staging-badge' strategy='beforeInteractive'>
          {stagingBadgeScript}
        </Script>
        {children}
      </body>
    </html>
  );
}
