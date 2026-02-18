import { render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';

import { PlaceholderPageLayout } from '@/components/placeholder-page-layout';
import type { FooterContent, NavbarContent } from '@/content';

vi.mock('@/components/page-layout', () => ({
  PageLayout: ({
    children,
    mainClassName,
  }: {
    children: ReactNode;
    mainClassName?: string;
  }) => (
    <div data-testid='page-layout' data-main-classname={mainClassName ?? ''}>
      {children}
    </div>
  ),
}));

describe('PlaceholderPageLayout', () => {
  const navbarContent = {} as NavbarContent;
  const footerContent = {} as FooterContent;

  it('uses the standardized placeholder main shell by default', () => {
    render(
      <PlaceholderPageLayout navbarContent={navbarContent} footerContent={footerContent}>
        Placeholder body
      </PlaceholderPageLayout>,
    );

    const layout = screen.getByTestId('page-layout');
    expect(layout.getAttribute('data-main-classname')).toContain('min-h-[52vh]');
    expect(layout).toHaveTextContent('Placeholder body');
  });

  it('allows overriding the main shell class contract', () => {
    render(
      <PlaceholderPageLayout
        navbarContent={navbarContent}
        footerContent={footerContent}
        mainClassName='min-h-[60vh]'
      >
        Placeholder body
      </PlaceholderPageLayout>,
    );

    const layout = screen.getByTestId('page-layout');
    expect(layout.getAttribute('data-main-classname')).toBe('min-h-[60vh]');
  });
});
