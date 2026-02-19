import { render, screen } from '@testing-library/react';
import { type AnchorHTMLAttributes, type ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';

import { SmartLink } from '@/components/shared/smart-link';

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

describe('SmartLink', () => {
  it('opens HTTP links in a new tab with secure rel', () => {
    render(<SmartLink href='https://example.com'>External</SmartLink>);

    const link = screen.getByRole('link', { name: 'External' });
    expect(link).toHaveAttribute('href', 'https://example.com');
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', 'noopener noreferrer');
    expect(link).not.toHaveAttribute('data-mocked-next-link');
  });

  it('uses Next Link for internal href values', () => {
    render(<SmartLink href='/about-us'>About us</SmartLink>);

    const link = screen.getByRole('link', { name: 'About us' });
    expect(link).toHaveAttribute('href', '/about-us');
    expect(link).toHaveAttribute('data-mocked-next-link', 'true');
    expect(link).not.toHaveAttribute('target');
  });

  it('allows explicit internal new-tab override', () => {
    render(
      <SmartLink href='/terms' openInNewTab>
        Terms
      </SmartLink>,
    );

    const link = screen.getByRole('link', { name: 'Terms' });
    expect(link).toHaveAttribute('href', '/terms');
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', 'noopener noreferrer');
  });

  it('keeps hash links in-page by default', () => {
    render(<SmartLink href='#resources'>Resources</SmartLink>);

    const link = screen.getByRole('link', { name: 'Resources' });
    expect(link).toHaveAttribute('href', '#resources');
    expect(link).not.toHaveAttribute('target');
    expect(link).not.toHaveAttribute('data-mocked-next-link');
  });

  it('neutralizes unsafe href values', () => {
    render(<SmartLink href='javascript:alert(1)'>Blocked</SmartLink>);

    const link = screen.getByRole('link', { name: 'Blocked' });
    expect(link).toHaveAttribute('href', '#');
    expect(link).not.toHaveAttribute('target');
    expect(link).not.toHaveAttribute('data-mocked-next-link');
  });

  it('exposes protocol bucket state to render-prop children', () => {
    render(
      <SmartLink href='mailto:hello@example.com'>
        {({ hrefKind, isExternal, isExternalHttp, opensInNewTab }) => (
          <span data-testid='smart-link-state'>
            {`${hrefKind}|${String(isExternal)}|${String(isExternalHttp)}|${String(opensInNewTab)}`}
          </span>
        )}
      </SmartLink>,
    );

    expect(screen.getByTestId('smart-link-state')).toHaveTextContent(
      'mailto|true|false|false',
    );
  });
});
