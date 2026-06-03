import { Lato, Poppins } from 'next/font/google';
import type { Metadata } from 'next';
import type { ReactNode } from 'react';

import './globals.css';

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

export const metadata: Metadata = {
  title: 'Evolve Sprouts Training',
  icons: {
    icon: '/images/evolvesprouts-logo.svg',
    shortcut: '/images/evolvesprouts-logo.svg',
  },
  robots: {
    index: false,
    follow: false,
    noarchive: true,
  },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang='en' className={`${lato.variable} ${poppins.variable}`}>
      <body>{children}</body>
    </html>
  );
}
