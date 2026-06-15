import type { ReactNode } from 'react';
import Script from 'next/script';

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
      <a
        href='#main-content'
        className='sr-only fixed left-4 top-4 z-[80] rounded-md bg-black px-4 py-2 text-sm font-semibold text-white focus:not-sr-only focus:outline focus:outline-2 focus:outline-offset-2 focus:outline-black'
      >
        {content.common.shell.skipToMainContentLabel}
      </a>
      <div
        id='environment-badge'
        className='pointer-events-none fixed right-4 top-4 z-50 hidden rounded-md bg-amber-500 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-white shadow-md'
      >
        {content.common.shell.environmentBadgeLabel}
      </div>
      <Script src='/scripts/show-staging-badge.js' strategy='afterInteractive' />
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
