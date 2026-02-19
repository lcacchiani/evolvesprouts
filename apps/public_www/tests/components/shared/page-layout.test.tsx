import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { PageLayout } from '@/components/shared/page-layout';
import enContent from '@/content/en.json';

vi.mock('@/components/sections/navbar', () => ({
  Navbar: ({ content }: { content: { brand: string } }) => (
    <header data-testid='navbar'>{content.brand}</header>
  ),
}));

vi.mock('@/components/sections/footer', () => ({
  Footer: ({ content }: { content: { brand: string } }) => (
    <footer data-testid='footer'>{content.brand}</footer>
  ),
}));

describe('PageLayout', () => {
  it('renders navbar, main region, and footer with default main attributes', () => {
    render(
      <PageLayout
        navbarContent={enContent.navbar}
        footerContent={enContent.footer}
      >
        <div>Inner content</div>
      </PageLayout>,
    );

    expect(screen.getByTestId('navbar')).toBeInTheDocument();
    expect(screen.getByText('Inner content')).toBeInTheDocument();
    expect(screen.getByTestId('footer')).toBeInTheDocument();

    const main = screen.getByRole('main');
    expect(main).toHaveAttribute('id', 'main-content');
    expect(main).toHaveAttribute('tabindex', '-1');
    expect(main).toHaveClass('min-h-screen');
  });

  it('accepts custom main id and className', () => {
    render(
      <PageLayout
        navbarContent={enContent.navbar}
        footerContent={enContent.footer}
        mainId='custom-main'
        mainClassName='custom-main-class'
      >
        <span>Custom content</span>
      </PageLayout>,
    );

    const main = screen.getByRole('main');
    expect(main).toHaveAttribute('id', 'custom-main');
    expect(main).toHaveClass('custom-main-class');
  });
});
