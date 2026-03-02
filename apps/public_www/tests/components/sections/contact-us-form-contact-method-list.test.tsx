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
            key: 'linkedin',
            href: 'https://www.linkedin.com/company/evolve-sprouts',
            label: 'LinkedIn',
            iconSrc: '/images/contact-linkedin.png',
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
    expect(screen.getByRole('link', { name: 'LinkedIn' })).toHaveAttribute(
      'href',
      'https://www.linkedin.com/company/evolve-sprouts',
    );
    expect(screen.getByRole('link', { name: 'WhatsApp' })).toHaveAttribute(
      'href',
      'https://wa.me/message/ZQHVW4DEORD5A1?src=qr',
    );
    const emailLink = screen.getByRole('link', { name: 'Email us' });
    const linkedInLink = screen.getByRole('link', { name: 'LinkedIn' });
    const whatsappLink = screen.getByRole('link', { name: 'WhatsApp' });

    expect(emailLink).toHaveAttribute('aria-label', 'Email us');
    expect(linkedInLink).toHaveAttribute('aria-label', 'LinkedIn');
    expect(whatsappLink).toHaveAttribute('aria-label', 'WhatsApp');
    expect(emailLink.className).toContain('flex-col');
    expect(emailLink.className).toContain('text-center');
    expect(emailLink.className).toContain('w-[100px]');
    expect(linkedInLink.className).toContain('w-auto');
    expect(whatsappLink.className).toContain('w-[100px]');
    for (const listItem of list.querySelectorAll('li')) {
      expect(listItem.className).toContain('m-[10px]');
    }
    expect(screen.queryByText('Email us')).toBeNull();
    expect(screen.queryByText('LinkedIn')).toBeNull();
    expect(screen.queryByText('WhatsApp')).toBeNull();

    const emailIcon = screen.getByTestId('contact-method-icon-email').querySelector('img');
    const linkedInIcon = screen.getByTestId('contact-method-icon-linkedin').querySelector('img');
    const whatsappIcon = screen
      .getByTestId('contact-method-icon-whatsapp')
      .querySelector('img');
    const emailIconContainer = screen.getByTestId('contact-method-icon-email');
    const linkedInIconContainer = screen.getByTestId('contact-method-icon-linkedin');
    expect(emailIconContainer.className).toContain('h-[100px]');
    expect(emailIconContainer.className).toContain('w-[100px]');
    expect(linkedInIconContainer.className).toContain('h-[100px]');
    expect(linkedInIconContainer.className).toContain('w-auto');
    expect(emailIcon).toHaveAttribute('src', '/images/contact-email.svg');
    expect(emailIcon).toHaveAttribute('width', '100');
    expect(emailIcon).toHaveAttribute('height', '100');
    expect(emailIcon?.className).toContain('h-[100px]');
    expect(emailIcon?.className).toContain('w-[100px]');
    expect(linkedInIcon).toHaveAttribute('src', '/images/contact-linkedin.png');
    expect(linkedInIcon).toHaveAttribute('width', '635');
    expect(linkedInIcon).toHaveAttribute('height', '540');
    expect(linkedInIcon?.className).toContain('h-[100px]');
    expect(linkedInIcon?.className).toContain('w-auto');
    expect(whatsappIcon).toHaveAttribute('src', '/images/contact-whatsapp.svg');
    expect(whatsappIcon?.className).toContain('h-[100px]');
    expect(whatsappIcon?.className).toContain('w-[100px]');
  });
});
