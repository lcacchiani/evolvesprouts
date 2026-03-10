import type { ReactElement } from 'react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('next/font/google', () => ({
  Lato: () => ({ variable: '--font-lato' }),
  Poppins: () => ({ variable: '--font-poppins' }),
}));
vi.mock('next/script', () => ({
  __esModule: true,
  default: (props: { src: string }) => <script data-testid='next-script' data-src={props.src} />,
}));

import { DEFAULT_LOCALE } from '@/content';
import RootLayout from '@/app/layout';

describe('RootLayout', () => {
  it('uses the default locale as the static html lang attribute', () => {
    const element = RootLayout({ children: <div>content</div> });
    const htmlProps = (element as ReactElement).props;

    expect(htmlProps.lang).toBe(DEFAULT_LOCALE);
  });

  it('sets suppressHydrationWarning on html for pre-hydration locale script', () => {
    const element = RootLayout({ children: <div>content</div> });
    const htmlProps = (element as ReactElement).props;

    expect(htmlProps.suppressHydrationWarning).toBe(true);
  });
});
