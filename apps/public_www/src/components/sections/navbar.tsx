import Image from 'next/image';
import Link from 'next/link';

import type { NavbarContent } from '@/content';

interface NavbarProps {
  content: NavbarContent;
}

const NAV_BACKGROUND = 'var(--figma-colors-frame-2147235259, #FFEEE3)';
const NAV_PILL_BACKGROUND = 'var(--figma-colors-frame-2147235267, #F6DECD)';
const NAV_TEXT_COLOR =
  'var(--figma-colors-join-our-sprouts-squad-community, #333333)';
const CTA_BACKGROUND = 'var(--figma-colors-frame-2147235222-2, #ED622E)';
const CTA_TEXT_COLOR = 'var(--figma-colors-desktop, #FFFFFF)';

const linkStyle = {
  backgroundColor: NAV_PILL_BACKGROUND,
  color: NAV_TEXT_COLOR,
  fontFamily: 'var(--figma-fontfamilies-lato, Lato), sans-serif',
  fontSize: 'var(--figma-fontsizes-18, 18px)',
  fontWeight: 'var(--figma-fontweights-600, 600)',
  lineHeight: 'var(--figma-lineheights-home-2, 100%)',
};

const localeStyle = {
  color: NAV_TEXT_COLOR,
  fontFamily: 'var(--figma-fontfamilies-urbanist, Urbanist), sans-serif',
  fontSize: 'var(--figma-fontsizes-20, 20px)',
  fontWeight: 'var(--figma-fontweights-500, 500)',
  lineHeight: 'var(--figma-lineheights-eng, 100%)',
};

const ctaStyle = {
  backgroundColor: CTA_BACKGROUND,
  color: CTA_TEXT_COLOR,
  fontFamily:
    'var(--figma-fontfamilies-plus-jakarta-sans, Plus Jakarta Sans), sans-serif',
  fontSize: 'var(--figma-fontsizes-22, 22px)',
  fontWeight: 'var(--figma-fontweights-600, 600)',
  lineHeight: 'var(--figma-lineheights-book-now, 100%)',
};

const LANGUAGE_ARIA_LABEL = 'Selected language: English';
const BOOK_NOW_LABEL = 'Book Now';

function LanguageChevronIcon() {
  return (
    <svg
      aria-hidden='true'
      viewBox='0 0 20 20'
      className='h-5 w-5'
      fill='none'
      xmlns='http://www.w3.org/2000/svg'
    >
      <path
        d='M5 8L10 13L15 8'
        stroke='var(--figma-colors-join-our-sprouts-squad-community, #333333)'
        strokeWidth='2'
        strokeLinecap='round'
        strokeLinejoin='round'
      />
    </svg>
  );
}

function LanguageSelectorButton({ className }: { className: string }) {
  return (
    <button
      type='button'
      className={className}
      aria-label={LANGUAGE_ARIA_LABEL}
    >
      <Image
        src='/flags/gb.png'
        alt='United Kingdom flag'
        width={30}
        height={30}
        className='h-[30px] w-[30px] rounded-full object-cover'
      />
      <span style={localeStyle}>Eng</span>
      <LanguageChevronIcon />
    </button>
  );
}

function BookNowButton({ className }: { className: string }) {
  return (
    <Link href='#courses' className={className} style={ctaStyle}>
      {BOOK_NOW_LABEL}
    </Link>
  );
}

export function Navbar({ content }: NavbarProps) {
  const links = Object.entries(content.links);

  return (
    <header
      data-figma-node='navbar'
      className='w-full border-b border-black/5'
      style={{ backgroundColor: NAV_BACKGROUND }}
    >
      <nav className='mx-auto flex w-full max-w-[1465px] items-center justify-between gap-3 px-4 py-4 sm:px-6 lg:min-h-[115px] lg:px-8 lg:py-0'>
        <Link
          href='/'
          className='shrink-0 text-lg font-semibold tracking-tight sm:text-xl lg:text-2xl'
          style={{
            color: 'var(--figma-colors-frame-2147235242, #174879)',
            fontFamily: 'var(--figma-fontfamilies-poppins, Poppins), sans-serif',
          }}
        >
          {content.brand}
        </Link>

        <ul className='hidden flex-1 items-center justify-center gap-1.5 lg:flex'>
          {links.map(([key, label]) => (
            <li key={key}>
              <Link
                href={`#${key}`}
                className='inline-flex h-[41px] items-center justify-center rounded-full px-4 transition-transform hover:scale-[1.02] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-black/40'
                style={linkStyle}
              >
                {label}
              </Link>
            </li>
          ))}
        </ul>

        <div className='hidden items-center gap-3 lg:flex'>
          <LanguageSelectorButton
            className='inline-flex h-[30px] items-center gap-[9px] px-[6px]'
          />
          <BookNowButton
            className='inline-flex h-[56px] items-center justify-center rounded-[10px] px-6 text-center transition-opacity hover:opacity-95'
          />
        </div>

        <details className='relative lg:hidden'>
          <summary
            className='flex h-11 w-11 list-none items-center justify-center rounded-xl border border-black/10 bg-white/80 [&::-webkit-details-marker]:hidden'
            aria-label='Open navigation menu'
          >
            <span className='sr-only'>Open navigation menu</span>
            <span className='flex flex-col gap-1.5'>
              <span
                className='block h-0.5 w-5 rounded-full'
                style={{ backgroundColor: NAV_TEXT_COLOR }}
              />
              <span
                className='block h-0.5 w-5 rounded-full'
                style={{ backgroundColor: NAV_TEXT_COLOR }}
              />
              <span
                className='block h-0.5 w-5 rounded-full'
                style={{ backgroundColor: NAV_TEXT_COLOR }}
              />
            </span>
          </summary>

          <div
            className='absolute inset-x-0 top-[calc(100%+0.5rem)] z-50 rounded-2xl border border-black/10 p-4 shadow-xl'
            style={{ backgroundColor: NAV_BACKGROUND }}
          >
            <ul className='space-y-2'>
              {links.map(([key, label]) => (
                <li key={key}>
                  <Link
                    href={`#${key}`}
                    className='inline-flex h-[41px] w-full items-center justify-center rounded-full px-4'
                    style={linkStyle}
                  >
                    {label}
                  </Link>
                </li>
              ))}
            </ul>

            <div className='mt-4 space-y-3 border-t border-black/10 pt-4'>
              <LanguageSelectorButton
                className='inline-flex h-[30px] w-full items-center justify-center gap-[9px] px-[6px]'
              />
              <BookNowButton
                className='inline-flex h-[56px] w-full items-center justify-center rounded-[10px] px-6 text-center'
              />
            </div>
          </div>
        </details>
      </nav>
    </header>
  );
}
