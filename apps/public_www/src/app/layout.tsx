import { Lato, Poppins } from 'next/font/google';
import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';

import { DEFAULT_LOCALE, SUPPORTED_LOCALES, type Locale } from '@/content';
import {
  getDirectionForLocale,
  type DocumentDirection,
} from '@/lib/locale-document';
import { GoogleTagManager } from '@/components/shared/google-tag-manager';
import { SITE_HOST, SITE_ORIGIN } from '@/lib/seo';
import './globals.css';

const GTM_ID = process.env.NEXT_PUBLIC_GTM_ID || '';
const GTM_ALLOWED_HOSTS = resolveGtmAllowedHosts();

function resolveGtmAllowedHosts(): string {
  const configuredHosts = process.env.NEXT_PUBLIC_GTM_ALLOWED_HOSTS;
  if (!configuredHosts || configuredHosts.trim() === '') {
    return SITE_HOST;
  }

  return configuredHosts;
}

const lato = Lato({
  subsets: ['latin'],
  variable: '--font-lato',
  weight: ['400', '700'],
  style: ['normal'],
  display: 'swap',
  preload: false,
});

const poppins = Poppins({
  subsets: ['latin'],
  variable: '--font-poppins',
  weight: ['500', '600', '700'],
  style: ['normal'],
  display: 'swap',
  preload: false,
});

const DOCUMENT_LOCALE_DIRECTIONS = Object.fromEntries(
  SUPPORTED_LOCALES.map((locale) => [locale, getDirectionForLocale(locale)]),
) as Record<Locale, DocumentDirection>;

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
      data-default-locale={DEFAULT_LOCALE}
      data-locale-directions={JSON.stringify(DOCUMENT_LOCALE_DIRECTIONS)}
      {...(GTM_ID
        ? {
            'data-gtm-id': GTM_ID,
            'data-gtm-allowed-hosts': GTM_ALLOWED_HOSTS,
          }
        : {})}
    >
      <body className='antialiased'>
        {/* eslint-disable-next-line @next/next/no-sync-scripts -- must run before hydration without inline wrappers */}
        <script src='/scripts/set-locale-document-attributes.js' />
        {/* eslint-disable-next-line @next/next/no-sync-scripts -- ensures duplicated responsive content is reduced when stylesheet loading fails */}
        <script src='/scripts/hide-css-sensitive-duplicates.js' />
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
        {/* eslint-disable-next-line @next/next/no-sync-scripts -- keeps staging badge bootstrap external and CSP-safe */}
        <script src='/scripts/show-staging-badge.js' />
        <GoogleTagManager />
        {children}
      </body>
    </html>
  );
}
