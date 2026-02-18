import { render, screen } from '@testing-library/react';
import type { AnchorHTMLAttributes, ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';

import { ButtonPrimitive } from '@/components/shared/button-primitive';

vi.mock('next/link', () => ({
  default: ({
    href,
    children,
    ...props
  }: {
    href: string;
    children: ReactNode;
  } & AnchorHTMLAttributes<HTMLAnchorElement>) => (
    <a data-mocked-next-link='true' href={href} {...props}>
      {children}
    </a>
  ),
}));

describe('ButtonPrimitive', () => {
  it('renders a native button by default', () => {
    render(<ButtonPrimitive variant='outline'>Print</ButtonPrimitive>);

    const button = screen.getByRole('button', { name: 'Print' });
    expect(button).toHaveAttribute('type', 'button');
    expect(button.className).toContain('es-btn');
    expect(button.className).toContain('es-btn--outline');
  });

  it('supports explicit submit button type', () => {
    render(
      <ButtonPrimitive variant='primary' type='submit'>
        Submit
      </ButtonPrimitive>,
    );

    const button = screen.getByRole('button', { name: 'Submit' });
    expect(button).toHaveAttribute('type', 'submit');
    expect(button.className).toContain('es-btn--primary');
  });

  it('uses Next Link for internal href values', () => {
    render(
      <ButtonPrimitive variant='pill' href='/about-us'>
        About us
      </ButtonPrimitive>,
    );

    const link = screen.getByRole('link', { name: 'About us' });
    expect(link).toHaveAttribute('href', '/about-us');
    expect(link).toHaveAttribute('data-mocked-next-link', 'true');
    expect(link.className).toContain('es-btn');
    expect(link.className).toContain('es-btn--pill');
  });

  it('opens external links in a new tab by default', () => {
    render(
      <ButtonPrimitive variant='primary' href='https://example.com'>
        External
      </ButtonPrimitive>,
    );

    const link = screen.getByRole('link', { name: 'External' });
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', 'noopener noreferrer');
  });

  it('applies state classes for active pills', () => {
    render(
      <ButtonPrimitive variant='pill' state='active'>
        Active
      </ButtonPrimitive>,
    );

    const button = screen.getByRole('button', { name: 'Active' });
    expect(button.className).toContain('es-btn--pill');
    expect(button.className).toContain('es-btn--state-active');
  });

  it('supports icon-only buttons without children', () => {
    render(<ButtonPrimitive variant='icon' aria-label='Close modal' />);

    const button = screen.getByRole('button', { name: 'Close modal' });
    expect(button.className).toContain('es-btn');
    expect(button.className).toContain('es-btn--icon');
  });

  it('exposes SmartLink state to render-prop children', () => {
    render(
      <ButtonPrimitive variant='primary' href='https://example.com'>
        {({ isLink, isExternalHttp, opensInNewTab }) => (
          <span data-testid='button-primitive-state'>
            {`${String(isLink)}|${String(isExternalHttp)}|${String(opensInNewTab)}`}
          </span>
        )}
      </ButtonPrimitive>,
    );

    expect(screen.getByTestId('button-primitive-state')).toHaveTextContent(
      'true|true|true',
    );
  });
});
