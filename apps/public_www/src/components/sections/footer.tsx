import Image from 'next/image';

import { ExternalLinkInlineContent } from '@/components/shared/external-link-icon';
import { SectionContainer } from '@/components/sections/shared/section-container';
import { SmartLink } from '@/components/shared/smart-link';
import type { FooterContent } from '@/content';
import { resolvePublicSiteConfig } from '@/lib/site-config';

interface FooterProps {
  content: FooterContent;
}

interface FooterLinkItem {
  label: string;
  href: string;
  icon?: string;
}

function resolveCurrentYearCopyright(value: string): string {
  const currentYear = String(new Date().getFullYear());
  if (/\b\d{4}\b/.test(value)) {
    return value.replace(/\b\d{4}\b/, currentYear);
  }

  const normalizedValue = value.replace(/^©\s*/, '').trim();
  return `© ${currentYear} ${normalizedValue}`;
}

interface SocialHrefConfig {
  instagramUrl?: string;
  linkedinUrl?: string;
}

interface SocialIconAsset {
  src: string;
  className: string;
}

function isGenericSocialRootHref(href: string, host: string): boolean {
  try {
    const parsedUrl = new URL(href);
    if (parsedUrl.hostname.toLowerCase() !== host) {
      return false;
    }

    return parsedUrl.pathname === '' || parsedUrl.pathname === '/';
  } catch {
    return false;
  }
}

function resolveConnectOnHref(
  item: FooterLinkItem,
  socialHrefConfig: SocialHrefConfig,
): string | undefined {
  if (item.icon === 'instagram') {
    if (socialHrefConfig.instagramUrl) {
      return socialHrefConfig.instagramUrl;
    }

    if (item.href.startsWith('/')) {
      return item.href;
    }

    if (
      isGenericSocialRootHref(item.href, 'instagram.com')
      || isGenericSocialRootHref(item.href, 'www.instagram.com')
    ) {
      return undefined;
    }

    return item.href;
  }

  if (item.icon === 'linkedin') {
    if (socialHrefConfig.linkedinUrl) {
      return socialHrefConfig.linkedinUrl;
    }

    if (item.href.startsWith('/')) {
      return item.href;
    }

    if (
      isGenericSocialRootHref(item.href, 'linkedin.com')
      || isGenericSocialRootHref(item.href, 'www.linkedin.com')
    ) {
      return undefined;
    }

    return item.href;
  }

  return item.href;
}

function resolveConnectOnItems(
  items: FooterLinkItem[],
  socialHrefConfig: SocialHrefConfig,
): FooterLinkItem[] {
  return items
    .map((item) => {
      const href = resolveConnectOnHref(item, socialHrefConfig);
      if (!href) {
        return null;
      }

      return {
        ...item,
        href,
      };
    })
    .filter((item): item is FooterLinkItem => item !== null);
}

const FOOTER_LOGO_CLASSNAME =
  'h-auto w-full max-w-[500px] -my-[100px] mx-auto';
const socialIconAssets: Partial<Record<string, SocialIconAsset>> = {
  linkedin: {
    src: '/images/contact-linkedin.svg',
    className: 'h-4 w-4',
  },
  instagram: {
    src: '/images/contact-instagram.svg',
    className: 'h-[18px] w-[18px]',
  },
};

function FooterColumnLinks({
  items,
  hasSocialIcons = false,
}: {
  items: FooterLinkItem[];
  hasSocialIcons?: boolean;
}) {
  const linkClassName = hasSocialIcons
    ? 'inline-flex items-center transition-opacity hover:opacity-70 es-footer-link es-footer-link--social'
    : 'inline-flex items-center transition-opacity hover:opacity-70 es-footer-link';

  return (
    <ul className='flex flex-col gap-[8px]'>
      {items.map((item) => {
        const icon = item.icon ? socialIconAssets[item.icon] : undefined;

        return (
          <li key={`${item.label}-${item.href}`}>
            <SmartLink
              href={item.href}
              className={linkClassName}
            >
              {({ isExternalHttp }) => (
                <>
                  {hasSocialIcons && icon ? (
                    <span className='shrink-0 es-footer-social-icon'>
                      <Image
                        src={icon.src}
                        alt=''
                        aria-hidden='true'
                        width={18}
                        height={18}
                        className={icon.className}
                      />
                    </span>
                  ) : null}
                  <ExternalLinkInlineContent isExternalHttp={isExternalHttp}>
                    {item.label}
                  </ExternalLinkInlineContent>
                </>
              )}
            </SmartLink>
          </li>
        );
      })}
    </ul>
  );
}

function FooterDesktopColumn({
  title,
  items,
  hasSocialIcons = false,
  className = '',
}: {
  title: string;
  items: FooterLinkItem[];
  hasSocialIcons?: boolean;
  className?: string;
}) {
  return (
    <section className={`w-full max-w-[223px] lg:pt-[70px] ${className}`.trim()}>
      <h3 className='pb-4 es-footer-column-title'>
        {title}
      </h3>
      <FooterColumnLinks items={items} hasSocialIcons={hasSocialIcons} />
    </section>
  );
}

function AccordionChevronIcon() {
  return (
    <svg
      aria-hidden='true'
      viewBox='0 0 18 10'
      className='h-[9px] w-[17px] shrink-0 transition-transform duration-300 group-open:rotate-180'
      fill='none'
      xmlns='http://www.w3.org/2000/svg'
    >
      <path
        d='M2 1.5L9 8L16 1.5'
        stroke='rgba(51,51,51,0.9)'
        strokeWidth='2'
        strokeLinecap='round'
        strokeLinejoin='round'
      />
    </svg>
  );
}

function FooterMobileAccordion({
  title,
  items,
  hasSocialIcons = false,
  hasTopBorder = true,
}: {
  title: string;
  items: FooterLinkItem[];
  hasSocialIcons?: boolean;
  hasTopBorder?: boolean;
}) {
  return (
    <details className={`group ${hasTopBorder ? 'border-t border-black/15' : ''} py-5`}>
      <summary className='flex w-full cursor-pointer list-none items-center justify-between [&::-webkit-details-marker]:hidden'>
        <span className='es-footer-column-title'>{title}</span>
        <AccordionChevronIcon />
      </summary>
      <div
        className='grid grid-rows-[0fr] overflow-hidden opacity-0 transition-[grid-template-rows,opacity] duration-300 ease-out group-open:grid-rows-[1fr] group-open:opacity-100'
      >
        <div className='min-h-0 pt-3'>
          <FooterColumnLinks items={items} hasSocialIcons={hasSocialIcons} />
        </div>
      </div>
    </details>
  );
}

export function Footer({ content }: FooterProps) {
  const publicSiteConfig = resolvePublicSiteConfig();
  const connectOnItems = resolveConnectOnItems(content.connectOn.items, {
    instagramUrl: publicSiteConfig.instagramUrl,
    linkedinUrl: publicSiteConfig.linkedinUrl,
  });
  const copyrightText = resolveCurrentYearCopyright(content.copyright);

  return (
    <footer data-figma-node='footer' className='w-full es-footer-root'>
      <section className='w-full es-section-shell-spacing'>
        <SectionContainer>
          <div className='mb-7 hidden justify-center sm:flex lg:hidden'>
            <Image
              src='/images/evolvesprouts-logo.svg'
              alt={content.brand}
              width={500}
              height={500}
              className={FOOTER_LOGO_CLASSNAME}
            />
          </div>
          <div className='hidden grid-cols-1 gap-10 sm:grid sm:grid-cols-4 sm:gap-x-8 sm:gap-y-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,500px)_minmax(0,1fr)_minmax(0,1fr)] lg:items-start lg:gap-x-0 lg:gap-y-10'>
            <FooterDesktopColumn
              title={content.quickLinks.title}
              items={content.quickLinks.items}
            />
            <FooterDesktopColumn
              title={content.services.title}
              items={content.services.items}
              className='lg:pl-6'
            />
            <div
              data-css-fallback='hide-when-css-missing'
              className='hidden justify-center lg:flex lg:pt-2'
            >
              <Image
                src='/images/evolvesprouts-logo.svg'
                alt={content.brand}
                width={500}
                height={500}
                className={FOOTER_LOGO_CLASSNAME}
              />
            </div>
            <FooterDesktopColumn
              title={content.aboutUs.title}
              items={content.aboutUs.items}
            />
            <FooterDesktopColumn
              title={content.connectOn.title}
              items={connectOnItems}
              hasSocialIcons
              className='lg:pl-6'
            />
          </div>

          <div data-css-fallback='hide-when-css-missing' className='sm:hidden'>
            <div className='pointer-events-none mb-7 flex justify-center'>
              <Image
                src='/images/evolvesprouts-logo.svg'
                alt={content.brand}
                width={500}
                height={500}
                className={FOOTER_LOGO_CLASSNAME}
              />
            </div>
            <FooterMobileAccordion
              title={content.quickLinks.title}
              items={content.quickLinks.items}
              hasTopBorder={false}
            />
            <FooterMobileAccordion
              title={content.services.title}
              items={content.services.items}
            />
            <FooterMobileAccordion
              title={content.aboutUs.title}
              items={content.aboutUs.items}
            />
            <FooterMobileAccordion
              title={content.connectOn.title}
              items={connectOnItems}
              hasSocialIcons
            />
          </div>
        </SectionContainer>
      </section>

      <div className='w-full px-4 pb-8 sm:px-6 lg:px-8'>
        <SectionContainer className='text-center'>
          <p className='es-footer-copyright'>{copyrightText}</p>
        </SectionContainer>
      </div>
    </footer>
  );
}
