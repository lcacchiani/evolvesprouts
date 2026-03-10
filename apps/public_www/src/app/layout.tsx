import { Lato, Poppins } from 'next/font/google';
import type { Metadata, Viewport } from 'next';
import Script from 'next/script';
import type { ReactNode } from 'react';

import { DEFAULT_LOCALE } from '@/content';
import enContent from '@/content/en.json';
import { GoogleTagManager } from '@/components/shared/google-tag-manager';
import {
  DEFAULT_SOCIAL_IMAGE,
  getSiteHost,
  getSiteOrigin,
  SITE_TITLE_SUFFIX,
} from '@/lib/seo';
import './globals.css';

const GTM_ID = process.env.NEXT_PUBLIC_GTM_ID || '';

function resolveGtmAllowedHosts(): string {
  const configuredHosts = process.env.NEXT_PUBLIC_GTM_ALLOWED_HOSTS;
  if (!configuredHosts || configuredHosts.trim() === '') {
    return getSiteHost();
  }

  return configuredHosts;
}

const lato = Lato({
  subsets: ['latin'],
  variable: '--font-lato',
  weight: ['400', '700'],
  style: ['normal'],
  display: 'swap',
  preload: true,
});

const poppins = Poppins({
  subsets: ['latin'],
  variable: '--font-poppins',
  weight: ['600', '700'],
  style: ['normal'],
  display: 'swap',
  preload: true,
});

export function generateMetadata(): Metadata {
  return {
    metadataBase: new URL(getSiteOrigin()),
    title: enContent.seo.fallbackTitle,
    description: enContent.seo.fallbackDescription,
    icons: {
      icon: '/favicon.ico',
      shortcut: '/favicon.ico',
    },
    openGraph: {
      title: enContent.seo.fallbackTitle,
      description: enContent.seo.fallbackDescription,
      siteName: SITE_TITLE_SUFFIX,
      type: 'website',
      images: [
        {
          url: DEFAULT_SOCIAL_IMAGE,
          alt: enContent.seo.defaultSocialImageAlt,
        },
      ],
    },
    twitter: {
      card: 'summary_large_image',
      title: enContent.seo.fallbackTitle,
      description: enContent.seo.fallbackDescription,
      images: [DEFAULT_SOCIAL_IMAGE],
    },
  };
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({
  children,
}: {
  children: ReactNode;
}) {
  const gtmAllowedHosts = resolveGtmAllowedHosts();

  return (
    <html
      lang={DEFAULT_LOCALE}
      suppressHydrationWarning
      className={`${lato.variable} ${poppins.variable}`}
      {...(GTM_ID
        ? {
            'data-gtm-id': GTM_ID,
            'data-gtm-allowed-hosts': gtmAllowedHosts,
          }
        : {})}
    >
      <body className='antialiased'>
        <Script src='/scripts/set-html-lang.js' strategy='beforeInteractive' />
        <script src='/scripts/hide-css-sensitive-duplicates.js' defer />
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
        <script src='/scripts/show-staging-badge.js' defer />
        <GoogleTagManager />
        {children}
      </body>
    </html>
  );
}
