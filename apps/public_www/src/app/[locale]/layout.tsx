import type { ReactNode } from 'react';

import { WhatsappContactButton } from '@/components/whatsapp-contact-button';
import {
  generateLocaleStaticParams,
  type LocaleRouteParams,
  resolveLocalePageContext,
} from '@/lib/locale-page';

interface LocaleLayoutProps {
  children: ReactNode;
  params: LocaleRouteParams;
}

export function generateStaticParams() {
  return generateLocaleStaticParams();
}

export default async function LocaleLayout({
  children,
  params,
}: LocaleLayoutProps) {
  const { locale, content } = await resolveLocalePageContext(params);
  const direction = content.meta.direction === 'rtl' ? 'rtl' : 'ltr';

  return (
    <div data-locale={locale} dir={direction}>
      {children}
      <WhatsappContactButton
        href={content.whatsappContact.href}
        ariaLabel={content.whatsappContact.ariaLabel}
      />
    </div>
  );
}
