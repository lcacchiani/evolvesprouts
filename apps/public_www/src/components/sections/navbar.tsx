'use client';

import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { SUPPORTED_LOCALES, type NavbarContent } from '@/content';

interface NavbarProps {
  content: NavbarContent;
}

const NAV_BACKGROUND = 'var(--figma-colors-frame-2147235259, #FFEEE3)';
const NAV_PILL_BACKGROUND = 'var(--figma-colors-frame-2147235267, #F6DECD)';
const NAV_TEXT_COLOR =
  'var(--figma-colors-join-our-sprouts-squad-community, #333333)';
const NAV_ACTIVE_TEXT = 'var(--figma-colors-frame-2147235222-2, #ED622E)';
const CTA_BACKGROUND = 'var(--figma-colors-frame-2147235222-2, #ED622E)';
const CTA_TEXT_COLOR = 'var(--figma-colors-desktop, #FFFFFF)';
const LOGO_SRC = '/images/evolvesprouts-logo.svg';

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

function normalizePath(path: string): string {
  let value = path.trim();

  if (value === '' || value === '#') {
    return value || '/';
  }

  if (/^https?:\/\//i.test(value)) {
    try {
      value = new URL(value).pathname;
    } catch {
      return value;
    }
  }

  value = value.split('#')[0] ?? value;
  value = value.split('?')[0] ?? value;

  if (!value.startsWith('/')) {
    value = `/${value}`;
  }

  value = value.replace(/\/+$/, '') || '/';
  const segments = value.split('/').filter(Boolean);

  if (
    segments.length > 0 &&
    SUPPORTED_LOCALES.includes(
      segments[0] as (typeof SUPPORTED_LOCALES)[number],
    )
  ) {
    const localizedValue = `/${segments.slice(1).join('/')}`;
    value = localizedValue === '/' ? '/' : localizedValue;
  }

  return value || '/';
}

function isHrefActive(currentPath: string, href: string): boolean {
  const targetPath = normalizePath(href);

  if (targetPath === '#') {
    return false;
  }

  if (targetPath === '/') {
    return currentPath === '/';
  }

  return (
    currentPath === targetPath || currentPath.startsWith(`${targetPath}/`)
  );
}

function isMenuItemActive(
  currentPath: string,
  item: NavbarContent['menuItems'][number],
): boolean {
  if (isHrefActive(currentPath, item.href)) {
    return true;
  }

  if (!item.children) {
    return false;
  }

  return item.children.some((child) =>
    isHrefActive(currentPath, child.href),
  );
}

function getTopLinkStyle(isActive: boolean) {
  return {
    ...linkStyle,
    backgroundColor: isActive ? '#FFFFFF' : NAV_PILL_BACKGROUND,
    color: isActive ? NAV_ACTIVE_TEXT : NAV_TEXT_COLOR,
  };
}

function getSubmenuLinkStyle(isActive: boolean) {
  return {
    ...linkStyle,
    backgroundColor: isActive ? '#FFFFFF' : '#FFF8F3',
    color: isActive ? NAV_ACTIVE_TEXT : NAV_TEXT_COLOR,
    fontSize: 'var(--figma-fontsizes-16, 16px)',
  };
}

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

function BookNowButton({
  className,
  href,
  label,
}: {
  className: string;
  href: string;
  label: string;
}) {
  return (
    <Link href={href} className={className} style={ctaStyle}>
      {label}
    </Link>
  );
}

export function Navbar({ content }: NavbarProps) {
  const pathname = usePathname() ?? '/';
  const currentPath = normalizePath(pathname);
  const logoSrc = content.logoSrc || LOGO_SRC;

  return (
    <header
      data-figma-node='navbar'
      className='w-full border-b border-black/5'
      style={{ backgroundColor: NAV_BACKGROUND }}
    >
      <nav className='mx-auto flex w-full max-w-[1465px] items-center justify-between gap-3 px-4 py-4 sm:px-6 lg:min-h-[115px] lg:px-8 lg:py-0'>
        <Link href='/' className='shrink-0'>
          <Image
            src={logoSrc}
            alt={content.brand}
            width={220}
            height={44}
            className='h-[38px] w-auto sm:h-[44px]'
          />
        </Link>

        <ul className='hidden flex-1 items-center justify-center gap-1.5 lg:flex'>
          {content.menuItems.map((item) => {
            const itemIsActive = isMenuItemActive(currentPath, item);

            if (!item.children) {
              return (
                <li key={item.label}>
                  <Link
                    href={item.href}
                    className='inline-flex h-[41px] items-center justify-center rounded-full px-4 transition-transform hover:scale-[1.02] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-black/40'
                    style={getTopLinkStyle(itemIsActive)}
                  >
                    {item.label}
                  </Link>
                </li>
              );
            }

            return (
              <li key={item.label} className='group relative'>
                <Link
                  href={item.href}
                  className='inline-flex h-[41px] items-center justify-center rounded-full px-4 pr-8 transition-transform hover:scale-[1.02] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-black/40'
                  style={getTopLinkStyle(itemIsActive)}
                >
                  {item.label}
                </Link>
                <span
                  aria-hidden='true'
                  className='pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-black/70'
                >
                  v
                </span>
                <ul className='invisible absolute left-0 top-[calc(100%+0.5rem)] z-50 min-w-[230px] space-y-2 rounded-2xl border border-black/10 bg-white p-3 opacity-0 shadow-xl transition group-hover:visible group-hover:opacity-100 group-focus-within:visible group-focus-within:opacity-100'>
                  {item.children.map((child) => (
                    <li key={child.label}>
                      <Link
                        href={child.href}
                        className='inline-flex h-[38px] w-full items-center justify-start rounded-full px-4 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-black/40'
                        style={getSubmenuLinkStyle(
                          isHrefActive(currentPath, child.href),
                        )}
                      >
                        {child.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </li>
            );
          })}
        </ul>

        <div className='hidden items-center gap-3 lg:flex'>
          <LanguageSelectorButton
            className='inline-flex h-[30px] items-center gap-[9px] px-[6px]'
          />
          <BookNowButton
            href={content.bookNow.href}
            label={content.bookNow.label}
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
              {content.menuItems.map((item) => {
                const itemIsActive = isMenuItemActive(currentPath, item);

                return (
                  <li key={item.label} className='space-y-2'>
                    <Link
                      href={item.href}
                      className='inline-flex h-[41px] w-full items-center justify-center rounded-full px-4'
                      style={getTopLinkStyle(itemIsActive)}
                    >
                      {item.label}
                    </Link>

                    {item.children && (
                      <ul className='space-y-2 pl-3'>
                        {item.children.map((child) => (
                          <li key={child.label}>
                            <Link
                              href={child.href}
                              className='inline-flex h-[38px] w-full items-center justify-center rounded-full px-4'
                              style={getSubmenuLinkStyle(
                                isHrefActive(currentPath, child.href),
                              )}
                            >
                              {child.label}
                            </Link>
                          </li>
                        ))}
                      </ul>
                    )}
                  </li>
                );
              })}
            </ul>

            <div className='mt-4 space-y-3 border-t border-black/10 pt-4'>
              <LanguageSelectorButton
                className='inline-flex h-[30px] w-full items-center justify-center gap-[9px] px-[6px]'
              />
              <BookNowButton
                href={content.bookNow.href}
                label={content.bookNow.label}
                className='inline-flex h-[56px] w-full items-center justify-center rounded-[10px] px-6 text-center'
              />
            </div>
          </div>
        </details>
      </nav>
    </header>
  );
}
