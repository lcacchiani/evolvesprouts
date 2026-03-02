/* eslint-disable @next/next/no-img-element */
import { render, screen } from '@testing-library/react';
import { type AnchorHTMLAttributes, type ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';

import { ContactMethodList } from '@/components/sections/contact-us-form-contact-method-list';

vi.mock('next/image', () => ({
  default: ({
    alt,
    ...props
  }: {
    alt?: string;
  } & Record<string, unknown>) => <img alt={alt ?? ''} {...props} />,
}));

vi.mock('@/components/shared/smart-link', () => ({
  SmartLink: ({
    href,
    children,
    ...props
  }: {
    href: string;
    children: ReactNode | ((args: { isExternalHttp: boolean }) => ReactNode);
  } & AnchorHTMLAttributes<HTMLAnchorElement>) => (
    <a href={href} {...props}>
      {typeof children === 'function'
        ? children({ isExternalHttp: /^https?:\/\//i.test(href) })
        : children}
    </a>
  ),
}));

describe('ContactMethodList', () => {
  it('renders localized method links and icons', () => {
    render(
      <ContactMethodList
        title='Contact methods'
        methods={[
          {
            key: 'email',
            href: 'mailto:hello@example.com',
            label: 'Email us',
            iconSrc: '/images/contact-email.svg',
          },
          {
            key: 'whatsapp',
            href: 'https://wa.me/message/ZQHVW4DEORD5A1?src=qr',
            label: 'WhatsApp',
            iconSrc: '/images/contact-whatsapp.svg',
          },
        ]}
      />,
    );

    expect(
      screen.getByRole('list', { name: 'Contact methods' }),
    ).toBeInTheDocument();
    const list = screen.getByRole('list', { name: 'Contact methods' });
    expect(list.className).toContain('flex');
    expect(list.className).toContain('flex-wrap');
    expect(list.className).toContain('max-w-full');
    expect(screen.getByRole('link', { name: 'Email us' })).toHaveAttribute(
      'href',
      'mailto:hello@example.com',
    );
    expect(screen.getByRole('link', { name: 'WhatsApp' })).toHaveAttribute(
      'href',
      'https://wa.me/message/ZQHVW4DEORD5A1?src=qr',
    );
    const emailLink = screen.getByRole('link', { name: 'Email us' });
    const whatsappLink = screen.getByRole('link', { name: 'WhatsApp' });

    expect(emailLink.className).toContain('es-section-body');
    expect(emailLink.className).toContain('flex-col');
    expect(emailLink.className).toContain('text-center');
    expect(emailLink.className).toContain('w-[100px]');
    expect(emailLink.querySelector('svg[data-external-link-icon="true"]')).toBeNull();
    expect(whatsappLink.querySelector('svg[data-external-link-icon="true"]')).not.toBeNull();

    const emailIcon = screen.getByTestId('contact-method-icon-email').querySelector('img');
    const whatsappIcon = screen
      .getByTestId('contact-method-icon-whatsapp')
      .querySelector('img');
    const emailIconContainer = screen.getByTestId('contact-method-icon-email');
    expect(emailIconContainer.className).toContain('h-[100px]');
    expect(emailIconContainer.className).toContain('w-[100px]');
    expect(emailIcon).toHaveAttribute('src', '/images/contact-email.svg');
    expect(emailIcon).toHaveAttribute('width', '100');
    expect(emailIcon).toHaveAttribute('height', '100');
    expect(emailIcon?.className).toContain('h-[100px]');
    expect(emailIcon?.className).toContain('w-[100px]');
    expect(whatsappIcon).toHaveAttribute('src', '/images/contact-whatsapp.svg');
    expect(whatsappIcon?.className).toContain('h-[100px]');
    expect(whatsappIcon?.className).toContain('w-[100px]');
  });
});
