import { Lato, Poppins } from 'next/font/google';
import type { Metadata, Viewport } from 'next';
import Script from 'next/script';
import type { ReactNode } from 'react';

import { buildLocaleDocumentAttributesScript } from '@/lib/locale-document';
import { SITE_ORIGIN } from '@/lib/seo';
import './globals.css';

const lato = Lato({
  subsets: ['latin'],
  variable: '--font-lato',
  weight: ['400', '700'],
  style: ['normal'],
  display: 'swap',
});

const poppins = Poppins({
  subsets: ['latin'],
  variable: '--font-poppins',
  weight: ['500', '600', '700'],
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

const localeDocumentAttributesScript = buildLocaleDocumentAttributesScript();

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
      className={`${lato.variable} ${poppins.variable}`}
    >
      <body className='antialiased'>
        <a
          href='#main-content'
          className='sr-only fixed left-4 top-4 z-[80] rounded-md bg-black px-4 py-2 text-sm font-semibold text-white focus:not-sr-only focus:outline focus:outline-2 focus:outline-offset-2 focus:outline-black'
        >
          Skip to main content
        </a>
        <div
          id='environment-badge'
          className='pointer-events-none fixed right-4 top-4 z-50 hidden rounded-md bg-amber-500 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-white shadow-md'
        >
          Staging
        </div>
        <Script id='show-staging-badge' strategy='beforeInteractive'>
          {stagingBadgeScript}
        </Script>
        <Script id='set-locale-document-attributes' strategy='beforeInteractive'>
          {localeDocumentAttributesScript}
        </Script>
        {children}
      </body>
    </html>
  );
}
