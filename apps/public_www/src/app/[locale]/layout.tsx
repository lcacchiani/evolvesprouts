import type { ReactNode } from 'react';

import { StructuredDataScript } from '@/components/shared/structured-data-script';
import { WhatsappContactButton } from '@/components/shared/whatsapp-contact-button';
import {
  generateLocaleStaticParams,
  type LocaleRouteParams,
  resolveLocalePageContext,
} from '@/lib/locale-page';
import { resolvePublicSiteConfig } from '@/lib/site-config';
import {
  buildLocalBusinessSchema,
  buildOrganizationSchema,
} from '@/lib/structured-data';

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
  const publicSiteConfig = resolvePublicSiteConfig();
  const whatsappHref = publicSiteConfig.whatsappUrl || content.whatsappContact.href;

  return (
    <div data-locale={locale} dir={direction}>
      <StructuredDataScript
        id={`organization-jsonld-${locale}`}
        data={buildOrganizationSchema({
          locale,
          content,
        })}
      />
      <StructuredDataScript
        id={`local-business-jsonld-${locale}`}
        data={buildLocalBusinessSchema({
          locale,
          content,
        })}
      />
      {children}
      <WhatsappContactButton
        href={whatsappHref}
        ariaLabel={content.whatsappContact.ariaLabel}
      />
    </div>
  );
}
