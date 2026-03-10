import { render, screen } from '@testing-library/react';
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
    const { container } = render(
      <RootLayout>
        <div>content</div>
      </RootLayout>,
    );

    const html = container.closest('html');
    expect(html?.getAttribute('lang') ?? DEFAULT_LOCALE).toBe(DEFAULT_LOCALE);
  });

  it('includes the set-html-lang script for runtime locale detection', () => {
    render(
      <RootLayout>
        <div>content</div>
      </RootLayout>,
    );

    const scripts = screen.getAllByTestId('next-script');
    const langScript = scripts.find(
      (s) => s.getAttribute('data-src') === '/scripts/set-html-lang.js',
    );
    expect(langScript).toBeDefined();
  });
});
