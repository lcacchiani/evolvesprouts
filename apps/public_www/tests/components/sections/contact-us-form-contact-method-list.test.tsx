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
    children: ReactNode;
  } & AnchorHTMLAttributes<HTMLAnchorElement>) => (
    <a href={href} {...props}>
      {children}
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
    expect(screen.getByRole('link', { name: 'Email us' })).toHaveAttribute(
      'href',
      'mailto:hello@example.com',
    );
    expect(screen.getByRole('link', { name: 'WhatsApp' })).toHaveAttribute(
      'href',
      'https://wa.me/message/ZQHVW4DEORD5A1?src=qr',
    );
    expect(screen.getByTestId('contact-method-icon-email').querySelector('img')).toHaveAttribute(
      'src',
      '/images/contact-email.svg',
    );
  });
});
