import type { CSSProperties, ReactNode } from 'react';
import Image from 'next/image';
import Link from 'next/link';

import type { FooterContent } from '@/content';

interface FooterProps {
  content: FooterContent;
}

interface FooterLinkItem {
  label: string;
  href: string;
  icon?: string;
}

const FOOTER_BACKGROUND =
  'var(--figma-colors-frame-2147235259, #FFEEE3)';
const HEADING_TEXT_COLOR =
  'var(--figma-colors-join-our-sprouts-squad-community, #333333)';
const BODY_TEXT_COLOR = 'var(--figma-colors-home, #4A4A4A)';
const CTA_BACKGROUND = 'var(--figma-colors-frame-2147235222-2, #ED622E)';
const CTA_TEXT_COLOR = 'var(--figma-colors-desktop, #FFFFFF)';

const headingStyle: CSSProperties = {
  color: HEADING_TEXT_COLOR,
  fontFamily: 'var(--figma-fontfamilies-poppins, Poppins), sans-serif',
  fontWeight: 'var(--figma-fontweights-700, 700)',
  letterSpacing:
    'calc(var(--figma-letterspacing-join-our-sprouts-squad-community, 0.77) * 1px)',
};

const ctaStyle: CSSProperties = {
  backgroundColor: CTA_BACKGROUND,
  color: CTA_TEXT_COLOR,
  fontFamily: 'var(--figma-fontfamilies-lato, Lato), sans-serif',
  fontWeight: 'var(--figma-fontweights-600, 600)',
  lineHeight:
    'var(--figma-lineheights-sign-up-to-our-monthly-newsletter, 100%)',
};

const columnTitleStyle: CSSProperties = {
  color: HEADING_TEXT_COLOR,
  fontFamily: 'var(--figma-fontfamilies-urbanist, Urbanist), sans-serif',
  fontSize: 'var(--figma-fontsizes-24, 24px)',
  fontWeight: 'var(--figma-fontweights-600, 600)',
  lineHeight: 'calc(var(--figma-lineheights-quick-links, 28) * 1px)',
  letterSpacing:
    'calc(var(--figma-letterspacing-quick-links, -0.5) * 1px)',
};

const linkStyle: CSSProperties = {
  color: BODY_TEXT_COLOR,
  fontFamily: 'var(--figma-fontfamilies-lato, Lato), sans-serif',
  fontSize: 'var(--figma-fontsizes-16, 16px)',
  fontWeight: 'var(--figma-fontweights-400, 400)',
  lineHeight: 'calc(var(--figma-lineheights-home, 26) * 1px)',
  letterSpacing: 'calc(var(--figma-letterspacing-home, 0.5) * 1px)',
};

const copyrightStyle: CSSProperties = {
  color: HEADING_TEXT_COLOR,
  fontFamily: 'var(--figma-fontfamilies-poppins, Poppins), sans-serif',
  fontSize: 'var(--figma-fontsizes-16, 16px)',
  fontWeight: 'var(--figma-fontweights-500, 500)',
  lineHeight:
    'calc(var(--figma-lineheights-2025-evolvesprouts, 28) * 1px)',
};

const socialIcons: Record<string, ReactNode> = {
  facebook: (
    <svg
      aria-hidden='true'
      viewBox='0 0 16 16'
      className='h-4 w-4'
      fill='currentColor'
      xmlns='http://www.w3.org/2000/svg'
    >
      <path d='M16 8.049c0-4.446-3.582-8.05-8-8.05C3.58 0 0 3.603 0 8.05c0 4.017 2.926 7.347 6.75 7.951v-5.625H4.719V8.049H6.75V6.275c0-2.017 1.195-3.131 3.022-3.131.876 0 1.791.157 1.791.157v1.98h-1.009c-.993 0-1.303.621-1.303 1.258v1.51h2.218l-.354 2.326H9.25V16c3.824-.604 6.75-3.934 6.75-7.951z' />
    </svg>
  ),
  linkedin: (
    <svg
      aria-hidden='true'
      viewBox='0 0 16 16'
      className='h-4 w-4'
      fill='currentColor'
      xmlns='http://www.w3.org/2000/svg'
    >
      <path d='M0 1.146C0 .513.526 0 1.175 0h13.65C15.474 0 16 .513 16 1.146v13.708c0 .633-.526 1.146-1.175 1.146H1.175C.526 16 0 15.487 0 14.854V1.146zm4.943 12.248V6.169H2.542v7.225h2.401zm-1.2-8.212c.837 0 1.358-.554 1.358-1.248-.015-.709-.52-1.248-1.342-1.248-.822 0-1.359.54-1.359 1.248 0 .694.521 1.248 1.327 1.248h.016zm4.908 8.212V9.359c0-.216.016-.432.08-.586.173-.431.568-.878 1.232-.878.869 0 1.216.662 1.216 1.634v3.865h2.401V9.25c0-2.22-1.184-3.252-2.764-3.252-1.274 0-1.845.712-2.165 1.213V6.169H6.29c.032.682 0 7.225 0 7.225h2.362z' />
    </svg>
  ),
  instagram: (
    <svg
      aria-hidden='true'
      viewBox='0 0 18 18'
      className='h-[18px] w-[18px]'
      fill='currentColor'
      xmlns='http://www.w3.org/2000/svg'
    >
      <path d='M9 1.622c2.403 0 2.688.01 3.637.052.877.04 1.354.187 1.671.31.42.163.72.358 1.035.673.315.315.51.615.673 1.035.123.317.27.794.31 1.671.043.95.052 1.234.052 3.637s-.01 2.688-.052 3.637c-.04.877-.187 1.354-.31 1.671a2.786 2.786 0 0 1-.673 1.035 2.786 2.786 0 0 1-1.035.673c-.317.123-.794.27-1.671.31-.95.043-1.234.052-3.637.052s-2.688-.01-3.637-.052c-.877-.04-1.354-.187-1.671-.31a2.786 2.786 0 0 1-1.035-.673 2.786 2.786 0 0 1-.673-1.035c-.123-.317-.27-.794-.31-1.671C1.632 11.688 1.622 11.403 1.622 9s.01-2.688.052-3.637c.04-.877.187-1.354.31-1.671.163-.42.358-.72.673-1.035.315-.315.615-.51 1.035-.673.317-.123.794-.27 1.671-.31C6.312 1.632 6.597 1.622 9 1.622zM9 0C6.556 0 6.249.012 5.289.056 4.331.1 3.677.267 3.105.504a4.408 4.408 0 0 0-1.594 1.038A4.408 4.408 0 0 0 .473 3.136C.237 3.708.07 4.362.025 5.32-.019 6.28-.007 6.587-.007 9.03s.012 2.751.056 3.711c.044.958.211 1.612.448 2.184a4.408 4.408 0 0 0 1.038 1.594 4.408 4.408 0 0 0 1.594 1.038c.572.237 1.226.404 2.184.448C6.28 18.019 6.587 18.007 9.03 18.007s2.751-.012 3.711-.056c.958-.044 1.612-.211 2.184-.448a4.408 4.408 0 0 0 1.594-1.038 4.408 4.408 0 0 0 1.038-1.594c.237-.572.404-1.226.448-2.184.044-.96.056-1.267.056-3.711s-.012-2.751-.056-3.711c-.044-.958-.211-1.612-.448-2.184a4.408 4.408 0 0 0-1.038-1.594A4.408 4.408 0 0 0 14.925.473C14.353.237 13.699.07 12.741.025 11.78-.019 11.474-.007 9.03-.007L9 0zm0 4.378a4.622 4.622 0 1 0 0 9.244 4.622 4.622 0 0 0 0-9.244zM9 12a3 3 0 1 1 0-6 3 3 0 0 1 0 6zm5.884-7.804a1.08 1.08 0 1 0-2.16 0 1.08 1.08 0 0 0 2.16 0z' />
    </svg>
  ),
  tiktok: (
    <svg
      aria-hidden='true'
      viewBox='0 0 16 16'
      className='h-4 w-4'
      fill='currentColor'
      xmlns='http://www.w3.org/2000/svg'
    >
      <path d='M9 0h1.98c.144 1.567 1.043 2.772 2.52 3.2V5.1c-1.067-.14-2.04-.6-2.82-1.32V10.2c0 3.6-3.52 5.58-6.24 3.6-1.76-1.28-2.4-3.92-1.2-6 1.12-1.94 3.8-2.86 5.76-2.14v2.3c-.34-.1-.72-.16-1.1-.12-1.14.12-2 1.04-1.96 2.2.04 1.28 1.14 2.2 2.4 2.04 1.22-.16 2.04-1.1 2.06-2.34L10.38 0H9z' />
    </svg>
  ),
};

function FooterColumnLinks({
  items,
  hasSocialIcons = false,
}: {
  items: FooterLinkItem[];
  hasSocialIcons?: boolean;
}) {
  return (
    <ul className='flex flex-col gap-[8px]'>
      {items.map((item) => {
        const icon = item.icon ? socialIcons[item.icon] : null;
        const isExternal = item.href.startsWith('http');

        return (
          <li key={`${item.label}-${item.href}`}>
            <Link
              href={item.href}
              className='inline-flex items-center transition-opacity hover:opacity-70'
              style={{
                ...linkStyle,
                gap: hasSocialIcons ? '12px' : '8px',
              }}
              {...(isExternal
                ? { target: '_blank', rel: 'noopener noreferrer' }
                : {})}
            >
              {hasSocialIcons && icon ? (
                <span className='shrink-0' style={{ color: BODY_TEXT_COLOR }}>
                  {icon}
                </span>
              ) : null}
              <span>{item.label}</span>
            </Link>
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
}: {
  title: string;
  items: FooterLinkItem[];
  hasSocialIcons?: boolean;
}) {
  return (
    <section className='w-full max-w-[223px] lg:pt-[70px]'>
      <h3 className='pb-4' style={columnTitleStyle}>
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
      className='h-[9px] w-[17px] shrink-0 transition-transform duration-200 group-open:rotate-180'
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
}: {
  title: string;
  items: FooterLinkItem[];
  hasSocialIcons?: boolean;
}) {
  return (
    <details className='group border-t border-black/15 py-5'>
      <summary className='flex cursor-pointer list-none items-center justify-between [&::-webkit-details-marker]:hidden'>
        <span style={columnTitleStyle}>{title}</span>
        <AccordionChevronIcon />
      </summary>
      <div className='pt-3'>
        <FooterColumnLinks items={items} hasSocialIcons={hasSocialIcons} />
      </div>
    </details>
  );
}

export function Footer({ content }: FooterProps) {
  const newsletterLink = '/contact-us';

  return (
    <footer
      data-figma-node='footer'
      className='w-full'
      style={{ backgroundColor: FOOTER_BACKGROUND }}
    >
      <section className='relative isolate overflow-hidden'>
        <Image
          src='/images/footer-community-bg.webp'
          alt=''
          fill
          sizes='100vw'
          className='object-cover object-top'
        />
        <div
          aria-hidden='true'
          className='pointer-events-none absolute inset-0'
          style={{
            background:
              'radial-gradient(circle at center top, rgba(255,255,255,0) 15%, rgba(255,238,227,0.74) 68%)',
          }}
        />

        <div className='relative z-10 mx-auto flex min-h-[420px] w-full max-w-[1465px] flex-col justify-center gap-7 px-4 py-14 sm:min-h-[530px] sm:px-6 sm:py-20 lg:min-h-[740px] lg:gap-9 lg:px-8'>
          <Image
            src='/images/community-badge.webp'
            alt=''
            width={241}
            height={247}
            className='h-auto w-[82px] sm:w-[96px] lg:w-[118px]'
          />
          <h2
            className='max-w-[620px] text-[clamp(1.9rem,6vw,55px)] leading-[1.12] sm:-mt-6 lg:-mt-[52px]'
            style={headingStyle}
          >
            {content.communityHeading}
          </h2>

          <Link
            href={newsletterLink}
            className='inline-flex h-14 w-full max-w-[500px] items-center justify-center rounded-[10px] px-5 text-center text-base transition-opacity hover:opacity-90 sm:h-[62px] sm:text-lg lg:h-[74px] lg:max-w-[410px] lg:text-[26px]'
            style={ctaStyle}
          >
            {content.newsletterCta}
          </Link>
        </div>
      </section>

      <section className='w-full px-4 pb-8 pt-9 sm:px-6 sm:pb-10 sm:pt-11 lg:px-8 lg:pb-12 lg:pt-16'>
        <div className='mx-auto w-full max-w-[1465px]'>
          <div className='hidden grid-cols-1 gap-10 sm:grid sm:grid-cols-2 sm:gap-x-8 sm:gap-y-10 lg:grid-cols-5 lg:items-start lg:gap-x-6 lg:gap-y-10'>
            <FooterDesktopColumn
              title={content.quickLinks.title}
              items={content.quickLinks.items}
            />
            <FooterDesktopColumn
              title={content.services.title}
              items={content.services.items}
            />
            <div className='flex justify-start sm:justify-center lg:justify-center lg:pt-2'>
              <Image
                src='/images/footer-icon.webp'
                alt={content.brand}
                width={120}
                height={120}
                className='h-auto w-[88px] sm:w-[96px] lg:w-[120px]'
              />
            </div>
            <FooterDesktopColumn
              title={content.aboutUs.title}
              items={content.aboutUs.items}
            />
            <FooterDesktopColumn
              title={content.connectOn.title}
              items={content.connectOn.items}
              hasSocialIcons
            />
          </div>

          <div className='sm:hidden'>
            <div className='mb-7 flex justify-center'>
              <Image
                src='/images/footer-icon.webp'
                alt={content.brand}
                width={120}
                height={120}
                className='h-auto w-[92px]'
              />
            </div>
            <FooterMobileAccordion
              title={content.quickLinks.title}
              items={content.quickLinks.items}
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
              items={content.connectOn.items}
              hasSocialIcons
            />
          </div>
        </div>
      </section>

      <div className='w-full px-4 pb-8 sm:px-6 lg:px-8'>
        <div className='mx-auto w-full max-w-[1465px]'>
          <p style={copyrightStyle}>{content.copyright}</p>
        </div>
      </div>
    </footer>
  );
}
