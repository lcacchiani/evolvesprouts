import type { ReactNode } from 'react';

import { renderQuotedDescriptionText } from '@/components/sections/shared/render-highlighted-text';
import { StructuredDataScript } from '@/components/shared/structured-data-script';
import { WhatsappContactButton } from '@/components/shared/whatsapp-contact-button';
import {
  generateLocaleStaticParams,
  type LocaleRouteParams,
  resolveLocalePageContext,
} from '@/lib/locale-page';
import { localizePath } from '@/lib/locale-routing';
import { ROUTES } from '@/lib/routes';
import { resolvePublicSiteConfig } from '@/lib/site-config';
import {
  buildLocalBusinessSchema,
  buildOrganizationSchema,
  buildWebSiteSchema,
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
  const noscriptCopy = content.common.shell.noscript;
  const localizedHomeHref = localizePath(ROUTES.home, locale);
  const localizedContactHref = localizePath(ROUTES.contact, locale);

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
      <StructuredDataScript
        id={`website-jsonld-${locale}`}
        data={buildWebSiteSchema({
          locale,
          content,
        })}
      />
      <noscript>
        <section className='mx-auto mt-4 max-w-3xl rounded-xl border border-black/10 bg-[#fdf8f4] px-4 py-4 text-sm text-black/80'>
          <p className='font-semibold text-black'>{noscriptCopy.title}</p>
          <p className='mt-2'>{renderQuotedDescriptionText(noscriptCopy.description)}</p>
          <p className='mt-3 flex flex-wrap gap-4'>
            <a href={localizedHomeHref} className='font-semibold underline underline-offset-4'>
              {noscriptCopy.homeLabel}
            </a>
            <a href={localizedContactHref} className='font-semibold underline underline-offset-4'>
              {noscriptCopy.contactLabel}
            </a>
          </p>
        </section>
      </noscript>
      {children}
      <WhatsappContactButton
        href={whatsappHref}
        ariaLabel={content.whatsappContact.ariaLabel}
      />
    </div>
  );
}
