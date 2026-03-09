import type { ReactElement } from 'react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('next/font/google', () => ({
  Lato: () => ({ variable: '--font-lato' }),
  Poppins: () => ({ variable: '--font-poppins' }),
}));

import RootLayout from '@/app/layout';

describe('RootLayout', () => {
  it('sets html lang from locale route params', async () => {
    const element = await RootLayout({
      children: <div>content</div>,
      params: Promise.resolve({ locale: 'zh-HK' }),
    });

    expect((element as ReactElement).props.lang).toBe('zh-HK');
  });

  it('falls back to default locale for unknown params', async () => {
    const element = await RootLayout({
      children: <div>content</div>,
      params: Promise.resolve({ locale: 'fr' }),
    });

    expect((element as ReactElement).props.lang).toBe('en');
  });
});
