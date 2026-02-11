import Image from 'next/image';
import Link from 'next/link';

import type { FooterContent } from '@/content';

interface FooterProps {
  content: FooterContent;
}

/* ------------------------------------------------------------------ */
/*  Design-token constants (from figma-tokens.css)                    */
/* ------------------------------------------------------------------ */

/** Main footer background — #FFEEE3 peach */
const FOOTER_BG =
  'var(--figma-colors-frame-2147235259, #FFEEE3)';

/** Dark text for headings — #333333 */
const HEADING_COLOR =
  'var(--figma-colors-join-our-sprouts-squad-community, #333333)';

/** Secondary text for links — #4A4A4A */
const LINK_COLOR = 'var(--figma-colors-home, #4A4A4A)';

/** CTA button orange — #ED622E */
const CTA_BG = 'var(--figma-colors-frame-2147235222-2, #ED622E)';

/** White text on CTA — #FFFFFF */
const CTA_TEXT = 'var(--figma-colors-desktop, #FFFFFF)';

/** Brand navy blue — #174879 */
const BRAND_COLOR =
  'var(--figma-colors-frame-2147235242, #174879)';

/* ------------------------------------------------------------------ */
/*  Typography style objects (mapped to figma typography tokens)       */
/* ------------------------------------------------------------------ */

/**
 * Hero heading — Poppins 700, 77px / 107 line-height, 0.77 letter-spacing
 * Token: --figma-typography-join-our-sprouts-squad-community
 */
const headingStyle: React.CSSProperties = {
  fontFamily:
    'var(--figma-fontfamilies-poppins, Poppins), sans-serif',
  fontWeight: 'var(--figma-fontweights-700, 700)' as string,
  letterSpacing:
    'var(--figma-letterspacing-join-our-sprouts-squad-community, 0.77px)',
  color: HEADING_COLOR,
};

/**
 * CTA button — Lato 600, 28px / 28 line-height
 * Token: --figma-typography-sign-up-to-our-monthly-newsletter
 */
const ctaStyle: React.CSSProperties = {
  backgroundColor: CTA_BG,
  color: CTA_TEXT,
  fontFamily:
    'var(--figma-fontfamilies-lato, Lato), sans-serif',
  fontSize: 'var(--figma-fontsizes-28, 28px)',
  fontWeight: 'var(--figma-fontweights-600, 600)' as string,
  lineHeight:
    'var(--figma-lineheights-sign-up-to-our-monthly-newsletter, 100%)',
};

/**
 * Column title — Urbanist 600, 24px / 28 line-height, -0.5 letter-spacing
 * Token: --figma-typography-quick-links
 */
const columnTitleStyle: React.CSSProperties = {
  fontFamily:
    'var(--figma-fontfamilies-urbanist, Urbanist), sans-serif',
  fontSize: 'var(--figma-fontsizes-24, 24px)',
  fontWeight: 'var(--figma-fontweights-600, 600)' as string,
  lineHeight: 'var(--figma-lineheights-quick-links, 28px)',
  letterSpacing:
    'var(--figma-letterspacing-quick-links, -0.5px)',
  color: HEADING_COLOR,
};

/**
 * Link text — Lato 400, 18px / 28 line-height, 0.5 letter-spacing
 * Token: --figma-typography-home
 */
const linkStyle: React.CSSProperties = {
  fontFamily:
    'var(--figma-fontfamilies-lato, Lato), sans-serif',
  fontSize: 'var(--figma-fontsizes-18, 18px)',
  fontWeight: 'var(--figma-fontweights-400, 400)' as string,
  lineHeight: 'var(--figma-lineheights-home, 28px)',
  letterSpacing: 'var(--figma-letterspacing-home, 0.5px)',
  color: LINK_COLOR,
};

/**
 * Copyright — Poppins 500, 16px / 28 line-height
 * Token: --figma-typography-2025-evolvesprouts
 */
const copyrightStyle: React.CSSProperties = {
  fontFamily:
    'var(--figma-fontfamilies-poppins, Poppins), sans-serif',
  fontSize: 'var(--figma-fontsizes-16, 16px)',
  fontWeight: 'var(--figma-fontweights-500, 500)' as string,
  lineHeight:
    'var(--figma-lineheights-2025-evolvesprouts, 28px)',
  color: HEADING_COLOR,
};

/* ------------------------------------------------------------------ */
/*  Social-media icon SVGs (16×16, matching Figma icon frames)        */
/* ------------------------------------------------------------------ */

const socialIcons: Record<string, React.ReactNode> = {
  facebook: (
    <svg
      aria-hidden='true'
      width='16'
      height='16'
      viewBox='0 0 16 16'
      fill='currentColor'
      xmlns='http://www.w3.org/2000/svg'
    >
      <path d='M16 8.049c0-4.446-3.582-8.05-8-8.05C3.58 0 0 3.603 0 8.05c0 4.017 2.926 7.347 6.75 7.951v-5.625H4.719V8.049H6.75V6.275c0-2.017 1.195-3.131 3.022-3.131.876 0 1.791.157 1.791.157v1.98h-1.009c-.993 0-1.303.621-1.303 1.258v1.51h2.218l-.354 2.326H9.25V16c3.824-.604 6.75-3.934 6.75-7.951z' />
    </svg>
  ),
  linkedin: (
    <svg
      aria-hidden='true'
      width='16'
      height='16'
      viewBox='0 0 16 16'
      fill='currentColor'
      xmlns='http://www.w3.org/2000/svg'
    >
      <path d='M0 1.146C0 .513.526 0 1.175 0h13.65C15.474 0 16 .513 16 1.146v13.708c0 .633-.526 1.146-1.175 1.146H1.175C.526 16 0 15.487 0 14.854V1.146zm4.943 12.248V6.169H2.542v7.225h2.401zm-1.2-8.212c.837 0 1.358-.554 1.358-1.248-.015-.709-.52-1.248-1.342-1.248-.822 0-1.359.54-1.359 1.248 0 .694.521 1.248 1.327 1.248h.016zm4.908 8.212V9.359c0-.216.016-.432.08-.586.173-.431.568-.878 1.232-.878.869 0 1.216.662 1.216 1.634v3.865h2.401V9.25c0-2.22-1.184-3.252-2.764-3.252-1.274 0-1.845.712-2.165 1.213V6.169H6.29c.032.682 0 7.225 0 7.225h2.362z' />
    </svg>
  ),
  instagram: (
    <svg
      aria-hidden='true'
      width='18'
      height='18'
      viewBox='0 0 18 18'
      fill='currentColor'
      xmlns='http://www.w3.org/2000/svg'
    >
      <path d='M9 1.622c2.403 0 2.688.01 3.637.052.877.04 1.354.187 1.671.31.42.163.72.358 1.035.673.315.315.51.615.673 1.035.123.317.27.794.31 1.671.043.95.052 1.234.052 3.637s-.01 2.688-.052 3.637c-.04.877-.187 1.354-.31 1.671a2.786 2.786 0 0 1-.673 1.035 2.786 2.786 0 0 1-1.035.673c-.317.123-.794.27-1.671.31-.95.043-1.234.052-3.637.052s-2.688-.01-3.637-.052c-.877-.04-1.354-.187-1.671-.31a2.786 2.786 0 0 1-1.035-.673 2.786 2.786 0 0 1-.673-1.035c-.123-.317-.27-.794-.31-1.671C1.632 11.688 1.622 11.403 1.622 9s.01-2.688.052-3.637c.04-.877.187-1.354.31-1.671.163-.42.358-.72.673-1.035.315-.315.615-.51 1.035-.673.317-.123.794-.27 1.671-.31C6.312 1.632 6.597 1.622 9 1.622zM9 0C6.556 0 6.249.012 5.289.056 4.331.1 3.677.267 3.105.504a4.408 4.408 0 0 0-1.594 1.038A4.408 4.408 0 0 0 .473 3.136C.237 3.708.07 4.362.025 5.32-.019 6.28-.007 6.587-.007 9.03s.012 2.751.056 3.711c.044.958.211 1.612.448 2.184a4.408 4.408 0 0 0 1.038 1.594 4.408 4.408 0 0 0 1.594 1.038c.572.237 1.226.404 2.184.448C6.28 18.019 6.587 18.007 9.03 18.007s2.751-.012 3.711-.056c.958-.044 1.612-.211 2.184-.448a4.408 4.408 0 0 0 1.594-1.038 4.408 4.408 0 0 0 1.038-1.594c.237-.572.404-1.226.448-2.184.044-.96.056-1.267.056-3.711s-.012-2.751-.056-3.711c-.044-.958-.211-1.612-.448-2.184a4.408 4.408 0 0 0-1.038-1.594A4.408 4.408 0 0 0 14.925.473C14.353.237 13.699.07 12.741.025 11.78-.019 11.474-.007 9.03-.007L9 0zm0 4.378a4.622 4.622 0 1 0 0 9.244 4.622 4.622 0 0 0 0-9.244zM9 12a3 3 0 1 1 0-6 3 3 0 0 1 0 6zm5.884-7.804a1.08 1.08 0 1 0-2.16 0 1.08 1.08 0 0 0 2.16 0z' />
    </svg>
  ),
  tiktok: (
    <svg
      aria-hidden='true'
      width='16'
      height='16'
      viewBox='0 0 16 16'
      fill='currentColor'
      xmlns='http://www.w3.org/2000/svg'
    >
      <path d='M9 0h1.98c.144 1.567 1.043 2.772 2.52 3.2V5.1c-1.067-.14-2.04-.6-2.82-1.32V10.2c0 3.6-3.52 5.58-6.24 3.6-1.76-1.28-2.4-3.92-1.2-6 1.12-1.94 3.8-2.86 5.76-2.14v2.3c-.34-.1-.72-.16-1.1-.12-1.14.12-2 1.04-1.96 2.2.04 1.28 1.14 2.2 2.4 2.04 1.22-.16 2.04-1.1 2.06-2.34L10.38 0H9z' />
    </svg>
  ),
};

/* ------------------------------------------------------------------ */
/*  Sub-components                                                    */
/* ------------------------------------------------------------------ */

/**
 * Renders a single footer link column.
 * Matches Figma "Frame 1000007078/79/81/80" — vertical layout,
 * 17px item spacing, title with 16px bottom padding.
 */
function FooterColumn({
  title,
  items,
  hasSocialIcons = false,
}: {
  title: string;
  items: { label: string; href: string; icon?: string }[];
  hasSocialIcons?: boolean;
}) {
  return (
    <div className='flex w-full max-w-[223px] flex-col gap-[17px]'>
      {/* Column title — pb-4 matches the 16px bottom padding in Figma */}
      <h3 className='pb-4' style={columnTitleStyle}>
        {title}
      </h3>
      <ul className='flex flex-col gap-[17px]'>
        {items.map((item) => (
          <li key={item.label}>
            <Link
              href={item.href}
              className='inline-flex items-center transition-opacity hover:opacity-70'
              style={{
                ...linkStyle,
                /* Social links use 14px icon-text gap, regular links 8px */
                gap: hasSocialIcons ? '14px' : '8px',
              }}
              {...(item.href.startsWith('http')
                ? { target: '_blank', rel: 'noopener noreferrer' }
                : {})}
            >
              {hasSocialIcons && item.icon && socialIcons[item.icon] && (
                <span
                  className='flex shrink-0 items-center justify-center'
                  style={{ color: LINK_COLOR }}
                >
                  {socialIcons[item.icon]}
                </span>
              )}
              {item.label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Main Footer component                                             */
/* ------------------------------------------------------------------ */

/**
 * Footer component matching the Figma design spec (footer.json).
 *
 * Layout hierarchy (Figma → HTML):
 *   footer GROUP (1920×1483)
 *     └ Frame 2147235259 (fill: #FFEEE3)
 *         ├ "Background Image" FRAME (1920×859)
 *         │   ├ "7 2" RECTANGLE — background photo (1490×836)
 *         │   ├ "Scrim" RECTANGLE — overlay (1920×859)
 *         │   ├ Heading TEXT (847×214)
 *         │   ├ Small logo GROUP (240×246)
 *         │   └ CTA button FRAME (500×82)
 *         ├ Quick Links column (223×269)
 *         ├ Services column (223×179)
 *         ├ About Us column (223×179)
 *         ├ Connect on column (223×224)
 *         ├ Large logo FRAME (470×482)
 *         └ Copyright TEXT (172×28)
 */
export function Footer({ content }: FooterProps) {
  return (
    <footer
      data-figma-node='footer'
      className='w-full'
      style={{ backgroundColor: FOOTER_BG }}
    >
      {/* ============================================================ */}
      {/* HERO / CTA SECTION                                           */}
      {/* Matches "Background Image" frame: 1920×859, fill #FFEEE3     */}
      {/* Contains: bg photo → scrim → heading + small logo + CTA      */}
      {/* ============================================================ */}
      <section className='relative w-full overflow-hidden'>
        {/* Aspect-ratio wrapper: 859/1920 ≈ 44.7% — preserves Figma proportions */}
        <div className='relative w-full pb-[60%] sm:pb-[50%] lg:pb-[44.7%]'>
          {/* Background image (1490×836 in Figma, named "7 2") */}
          {/* Replace /images/footer-bg.svg with the real photo when available */}
          <Image
            src='/images/footer-bg.svg'
            alt=''
            fill
            className='object-cover object-center'
            priority={false}
          />

          {/* Scrim overlay (1920×859 in Figma) — semi-transparent warm wash */}
          <div
            className='absolute inset-0 z-[1]'
            style={{
              background:
                'linear-gradient(180deg, rgba(255,238,227,0.3) 0%, rgba(255,238,227,0.75) 100%)',
            }}
          />

          {/* Content overlay — heading, small logo, CTA */}
          <div className='absolute inset-0 z-[2] flex flex-col justify-center px-4 sm:px-6 lg:px-8'>
            <div className='mx-auto w-full max-w-[1465px]'>
              {/* Row: heading (left) + small logo (right) */}
              <div className='flex items-center justify-between gap-6'>
                {/* Heading — 847×214 in Figma, Poppins 77px bold */}
                <h2
                  className='max-w-[500px] text-3xl leading-tight sm:max-w-[650px] sm:text-4xl sm:leading-tight md:text-5xl md:leading-tight lg:max-w-[847px] lg:text-[77px] lg:leading-[107px]'
                  style={headingStyle}
                >
                  {content.communityHeading}
                </h2>

                {/* Small Evolve Sprouts logo — 240×246 in Figma */}
                {/* Replace with exported logo asset when available */}
                <div className='hidden shrink-0 lg:block'>
                  <Image
                    src='/images/evolve-sprouts-logo.svg'
                    alt={content.brand}
                    width={240}
                    height={246}
                    className='h-auto w-[160px] xl:w-[240px]'
                  />
                </div>
              </div>

              {/* CTA button — 500×82 in Figma, #ED622E rounded-lg */}
              <div className='mt-6 sm:mt-8 lg:mt-10'>
                <Link
                  href='/newsletter'
                  className='inline-flex h-[52px] items-center justify-center rounded-lg px-5 transition-opacity hover:opacity-90 sm:h-[64px] sm:px-6 sm:text-xl lg:h-[82px] lg:w-[500px] lg:px-6'
                  style={ctaStyle}
                >
                  {content.newsletterCta}
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ============================================================ */}
      {/* LINK COLUMNS + LARGE LOGO                                    */}
      {/* Figma: 4 columns (223px each) on left, large logo (470×482)  */}
      {/* on right, all positioned below the hero section.             */}
      {/* ============================================================ */}
      <section className='w-full px-4 py-10 sm:px-6 sm:py-12 lg:px-8 lg:py-16'>
        <div className='mx-auto flex max-w-[1465px] flex-col gap-10 lg:flex-row lg:items-start lg:justify-between lg:gap-6'>
          {/* Link columns — 4 columns, each max 223px wide */}
          <div className='grid flex-1 grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-4 lg:gap-6'>
            <FooterColumn
              title={content.quickLinks.title}
              items={content.quickLinks.items}
            />
            <FooterColumn
              title={content.services.title}
              items={content.services.items}
            />
            <FooterColumn
              title={content.aboutUs.title}
              items={content.aboutUs.items}
            />
            <FooterColumn
              title={content.connectOn.title}
              items={content.connectOn.items}
              hasSocialIcons
            />
          </div>

          {/* Large Evolve Sprouts logo — 470×482 in Figma */}
          {/* Replace with exported logo asset when available */}
          <div className='flex justify-center lg:shrink-0 lg:justify-end'>
            <Image
              src='/images/evolve-sprouts-logo-large.svg'
              alt={content.brand}
              width={470}
              height={482}
              className='h-auto w-[240px] sm:w-[300px] lg:w-[380px] xl:w-[470px]'
            />
          </div>
        </div>
      </section>

      {/* ============================================================ */}
      {/* COPYRIGHT BAR                                                */}
      {/* Matches: "© 2025 Evolvesprouts" TEXT (172×28)                */}
      {/* Poppins 500 / 16px / 28 line-height / #333333               */}
      {/* ============================================================ */}
      <div className='w-full px-4 pb-8 sm:px-6 lg:px-8'>
        <div className='mx-auto max-w-[1465px]'>
          <p style={copyrightStyle}>{content.copyright}</p>
        </div>
      </div>
    </footer>
  );
}
