import type { ReactNode } from 'react';

import { LocaleDocumentAttributes } from '@/components/locale-document-attributes';
import { WhatsappContactButton } from '@/components/whatsapp-contact-button';
import {
  SUPPORTED_LOCALES,
  DEFAULT_LOCALE,
  getContent,
  isValidLocale,
} from '@/content';

interface LocaleLayoutProps {
  children: ReactNode;
  params: Promise<{ locale: string }>;
}

export function generateStaticParams() {
  return SUPPORTED_LOCALES.map((locale) => ({ locale }));
}

export default async function LocaleLayout({
  children,
  params,
}: LocaleLayoutProps) {
  const { locale } = await params;
  const validLocale = isValidLocale(locale) ? locale : DEFAULT_LOCALE;
  const content = getContent(validLocale);
  const direction = content.meta.direction === 'rtl' ? 'rtl' : 'ltr';

  return (
    <div data-locale={validLocale} dir={direction}>
      <LocaleDocumentAttributes locale={validLocale} direction={direction} />
      {children}
      <WhatsappContactButton
        href={content.whatsappContact.href}
        ariaLabel={content.whatsappContact.ariaLabel}
      />
    </div>
  );
}
