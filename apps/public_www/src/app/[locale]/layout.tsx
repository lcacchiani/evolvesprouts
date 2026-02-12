import type { ReactNode } from 'react';

import { LocaleDocumentAttributes } from '@/components/locale-document-attributes';
import { WhatsappContactButton } from '@/components/whatsapp-contact-button';
import { SUPPORTED_LOCALES } from '@/content';
import { resolveLocalePageContext } from '@/lib/locale-page';

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
  const { locale, content } = await resolveLocalePageContext(params);
  const direction = content.meta.direction === 'rtl' ? 'rtl' : 'ltr';

  return (
    <div data-locale={locale} dir={direction}>
      <LocaleDocumentAttributes locale={locale} direction={direction} />
      {children}
      <WhatsappContactButton
        href={content.whatsappContact.href}
        ariaLabel={content.whatsappContact.ariaLabel}
      />
    </div>
  );
}
