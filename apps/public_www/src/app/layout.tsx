import { Lato, Plus_Jakarta_Sans, Poppins, Urbanist } from 'next/font/google';
import type { Metadata, Viewport } from 'next';
import Script from 'next/script';
import type { ReactNode } from 'react';

import { SITE_ORIGIN } from '@/lib/seo';
import './globals.css';

const lato = Lato({
  subsets: ['latin'],
  variable: '--font-lato',
  weight: ['300', '400', '700', '900'],
  style: ['normal', 'italic'],
  display: 'swap',
});

const poppins = Poppins({
  subsets: ['latin'],
  variable: '--font-poppins',
  weight: ['400', '500', '600', '700', '800'],
  style: ['normal', 'italic'],
  display: 'swap',
});

const urbanist = Urbanist({
  subsets: ['latin'],
  variable: '--font-urbanist',
  weight: ['400', '500', '600', '700', '800'],
  style: ['normal', 'italic'],
  display: 'swap',
});

const plusJakartaSans = Plus_Jakarta_Sans({
  subsets: ['latin'],
  variable: '--font-plus-jakarta-sans',
  weight: ['400', '500', '600', '700', '800'],
  style: ['normal'],
  display: 'swap',
});

const stagingBadgeScript = `
(function showStagingBadge() {
  var host = window.location.hostname.toLowerCase();
  var isStagingHost = host.includes('staging') || host.includes('preprod');
  if (!isStagingHost) {
    return;
  }

  var robotsMeta = document.querySelector('meta[name="robots"]');
  if (!robotsMeta) {
    robotsMeta = document.createElement('meta');
    robotsMeta.setAttribute('name', 'robots');
    document.head.appendChild(robotsMeta);
  }
  robotsMeta.setAttribute('content', 'noindex, nofollow, noarchive');

  var badge = document.getElementById('environment-badge');
  if (badge) {
    badge.classList.remove('hidden');
  }
})();
`;

export const metadata: Metadata = {
  metadataBase: new URL(SITE_ORIGIN),
  title: 'Evolve Sprouts',
  description: 'Evolve Sprouts public website.',
  icons: {
    icon: '/favicon.ico',
    shortcut: '/favicon.ico',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <html
      lang='en'
      suppressHydrationWarning
      className={`${lato.variable} ${poppins.variable} ${urbanist.variable} ${plusJakartaSans.variable}`}
    >
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
