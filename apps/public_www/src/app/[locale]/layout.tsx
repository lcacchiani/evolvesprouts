import type { ReactNode } from 'react';

import type { Locale } from '@/content';
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
} from '@/lib/structured-data';

interface LocaleLayoutProps {
  children: ReactNode;
  params: LocaleRouteParams;
}

const NOSCRIPT_COPY: Record<
  Locale,
  {
    title: string;
    description: string;
    homeLabel: string;
    contactLabel: string;
  }
> = {
  en: {
    title: 'JavaScript is disabled.',
    description:
      'Some interactive features are unavailable. You can still browse key pages below.',
    homeLabel: 'Go to Home',
    contactLabel: 'Contact Us',
  },
  'zh-CN': {
    title: 'JavaScript 已禁用。',
    description: '部分交互功能暂不可用。您仍可访问以下主要页面。',
    homeLabel: '前往首页',
    contactLabel: '联系我们',
  },
  'zh-HK': {
    title: 'JavaScript 已停用。',
    description: '部分互動功能暫不可用。你仍可瀏覽以下主要頁面。',
    homeLabel: '前往首頁',
    contactLabel: '聯絡我們',
  },
};

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
  const noscriptCopy = NOSCRIPT_COPY[locale];
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
      <noscript>
        <section className='mx-auto mt-4 max-w-3xl rounded-xl border border-black/10 bg-[#fdf8f4] px-4 py-4 text-sm text-black/80'>
          <p className='font-semibold text-black'>{noscriptCopy.title}</p>
          <p className='mt-2'>{noscriptCopy.description}</p>
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
