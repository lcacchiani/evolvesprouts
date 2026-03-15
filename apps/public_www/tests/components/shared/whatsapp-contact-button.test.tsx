/* eslint-disable @next/next/no-img-element */
import { fireEvent, render, screen } from '@testing-library/react';
import { type AnchorHTMLAttributes, type ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';

import { WhatsappContactButton } from '@/components/shared/whatsapp-contact-button';
import { trackAnalyticsEvent } from '@/lib/analytics';

vi.mock('@/components/shared/smart-link', () => ({
  SmartLink: ({
    href,
    children,
    ...props
  }: {
    href: string;
    children: ReactNode;
  } & AnchorHTMLAttributes<HTMLAnchorElement>) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

vi.mock('next/image', () => ({
  default: ({
    alt,
    ...props
  }: {
    alt?: string;
  } & Record<string, unknown>) => <img alt={alt ?? ''} {...props} />,
}));

vi.mock('@/lib/analytics', () => ({
  trackAnalyticsEvent: vi.fn(),
}));

describe('WhatsappContactButton', () => {
  it('does not render when href is empty', () => {
    const { container } = render(
      <WhatsappContactButton href='' ariaLabel='Open WhatsApp' />,
    );

    expect(container.firstChild).toBeNull();
  });

  it('renders a floating WhatsApp link with accessible label', () => {
    render(
      <WhatsappContactButton
        href='https://wa.me/message/ZQHVW4DEORD5A1?src=qr'
        ariaLabel='Open WhatsApp'
      />,
    );

    const link = screen.getByRole('link', { name: 'Open WhatsApp' });
    expect(link).toHaveAttribute(
      'href',
      'https://wa.me/message/ZQHVW4DEORD5A1?src=qr',
    );
    expect(link.querySelector('img')).toHaveAttribute('src', '/images/contact-whatsapp.svg');
    expect(link.className).toContain('es-whatsapp-contact-button-safe-bottom');
    expect(link.className).toContain('right-[30px]');

    fireEvent.click(link);
    expect(trackAnalyticsEvent).toHaveBeenCalledWith('whatsapp_click', {
      sectionId: 'whatsapp-contact-button',
      ctaLocation: 'floating_button',
    });
  });
});
