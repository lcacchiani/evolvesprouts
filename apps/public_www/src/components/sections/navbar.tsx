'use client';

import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useId, useRef, useState } from 'react';

import {
  DEFAULT_LOCALE,
  SUPPORTED_LOCALES,
  type Locale,
  type NavbarContent,
} from '@/content';

interface NavbarProps {
  content: NavbarContent;
}

type MenuItem = NavbarContent['menuItems'][number];
type SubmenuItem = NonNullable<MenuItem['children']>[number];

const NAV_BACKGROUND = 'var(--figma-colors-frame-2147235259, #FFEEE3)';
const NAV_PILL_BACKGROUND = 'var(--figma-colors-frame-2147235267, #F6DECD)';
const NAV_TEXT_COLOR =
  'var(--figma-colors-join-our-sprouts-squad-community, #333333)';
const NAV_ACTIVE_TEXT = 'var(--figma-colors-frame-2147235222-2, #ED622E)';
const NAV_ACTIVE_BACKGROUND = '#F2A975';
const CTA_BACKGROUND = 'var(--figma-colors-frame-2147235222-2, #ED622E)';
const CTA_TEXT_COLOR = 'var(--figma-colors-desktop, #FFFFFF)';
const LOGO_SRC = '/images/evolvesprouts-logo.svg';
const MOBILE_PANEL_WIDTH_CLASS = 'w-[min(88vw,360px)]';
const FOCUSABLE_ELEMENT_SELECTOR =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

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

interface LanguageOption {
  locale: Locale;
  label: string;
  shortLabel: string;
  flagSrc: string;
}

interface LanguageSelectorContent {
  menuAriaLabel: string;
  selectedLanguageAriaPrefix: string;
  options: readonly LanguageOption[];
}

interface RawLanguageOption {
  locale: string;
  label: string;
  shortLabel: string;
  flagSrc: string;
}

const DEFAULT_LANGUAGE_OPTIONS: readonly LanguageOption[] = [
  {
    locale: 'en',
    label: 'English',
    shortLabel: 'Eng',
    flagSrc: '/flags/gb.png',
  },
  {
    locale: 'zh-CN',
    label: 'Chinese (Simplified)',
    shortLabel: 'SC',
    flagSrc: '/flags/cn.png',
  },
  {
    locale: 'zh-HK',
    label: 'Chinese (Traditional)',
    shortLabel: 'TC',
    flagSrc: '/flags/hk.png',
  },
];

const DEFAULT_LANGUAGE_MENU_ARIA_LABEL = 'Select language';
const DEFAULT_SELECTED_LANGUAGE_ARIA_PREFIX = 'Selected language';

function isLocale(value: string): value is Locale {
  return SUPPORTED_LOCALES.includes(value as Locale);
}

function sanitizePath(path: string): string {
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

  return value.replace(/\/+$/, '') || '/';
}

function getLocaleFromPath(path: string): Locale {
  const segments = sanitizePath(path).split('/').filter(Boolean);
  if (segments.length > 0 && isLocale(segments[0])) {
    return segments[0];
  }

  return DEFAULT_LOCALE;
}

function normalizePath(path: string): string {
  let value = sanitizePath(path);
  const segments = value.split('/').filter(Boolean);

  if (segments.length > 0 && isLocale(segments[0])) {
    const localizedValue = `/${segments.slice(1).join('/')}`;
    value = localizedValue === '/' ? '/' : localizedValue;
  }

  return value || '/';
}

function localizePath(path: string, locale: Locale): string {
  const basePath = normalizePath(path);
  return basePath === '/' ? `/${locale}` : `/${locale}${basePath}`;
}

function isExternalHref(href: string): boolean {
  return (
    /^https?:\/\//i.test(href) ||
    href.startsWith('mailto:') ||
    href.startsWith('tel:')
  );
}

function getFocusableElements(container: HTMLElement): HTMLElement[] {
  return Array.from(
    container.querySelectorAll<HTMLElement>(FOCUSABLE_ELEMENT_SELECTOR),
  ).filter((element) => {
    if (element.hasAttribute('disabled')) {
      return false;
    }

    return element.getAttribute('aria-hidden') !== 'true';
  });
}

function localizeHref(href: string, locale: Locale): string {
  const value = href.trim();
  if (value === '' || value === '#') {
    return value || '/';
  }

  if (isExternalHref(value)) {
    return value;
  }

  const hashIndex = value.indexOf('#');
  const hashValue = hashIndex >= 0 ? value.slice(hashIndex) : '';
  const withoutHash = hashIndex >= 0 ? value.slice(0, hashIndex) : value;
  const queryIndex = withoutHash.indexOf('?');
  const queryValue = queryIndex >= 0 ? withoutHash.slice(queryIndex) : '';
  const pathnameValue =
    queryIndex >= 0 ? withoutHash.slice(0, queryIndex) : withoutHash;

  return `${localizePath(pathnameValue || '/', locale)}${queryValue}${hashValue}`;
}

function resolveLanguageSelectorContent(
  content: NavbarContent,
): LanguageSelectorContent {
  const selector = (content as NavbarContent & {
    languageSelector?: {
      menuAriaLabel?: string;
      selectedLanguageAriaPrefix?: string;
      options?: RawLanguageOption[];
    };
  }).languageSelector;

  const normalizedOptions = (selector?.options ?? [])
    .map((option) => {
      if (!isLocale(option.locale)) {
        return null;
      }

      const label = option.label?.trim();
      const shortLabel = option.shortLabel?.trim();
      const flagSrc = option.flagSrc?.trim();
      if (!label || !shortLabel || !flagSrc) {
        return null;
      }

      return {
        locale: option.locale,
        label,
        shortLabel,
        flagSrc,
      } as LanguageOption;
    })
    .filter((option): option is LanguageOption => option !== null);

  return {
    menuAriaLabel:
      selector?.menuAriaLabel?.trim() || DEFAULT_LANGUAGE_MENU_ARIA_LABEL,
    selectedLanguageAriaPrefix:
      selector?.selectedLanguageAriaPrefix?.trim() ||
      DEFAULT_SELECTED_LANGUAGE_ARIA_PREFIX,
    options:
      normalizedOptions.length > 0
        ? normalizedOptions
        : DEFAULT_LANGUAGE_OPTIONS,
  };
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
    backgroundColor: isActive ? NAV_ACTIVE_BACKGROUND : NAV_PILL_BACKGROUND,
    color: NAV_TEXT_COLOR,
  };
}

function getSubmenuLinkStyle(isActive: boolean) {
  return {
    ...linkStyle,
    backgroundColor: isActive ? '#FFE0CA' : '#FFF0E5',
    color: isActive ? NAV_ACTIVE_TEXT : NAV_TEXT_COLOR,
    fontSize: 'var(--figma-fontsizes-16, 16px)',
    fontWeight: 500,
  };
}

function LanguageChevronIcon({ isOpen = false }: { isOpen?: boolean }) {
  return (
    <svg
      aria-hidden='true'
      viewBox='0 0 20 20'
      className={`h-5 w-5 transition-transform ${isOpen ? 'rotate-180' : ''}`}
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

function MobileChevronIcon({ isExpanded }: { isExpanded: boolean }) {
  return (
    <svg
      aria-hidden='true'
      viewBox='0 0 16 16'
      className={`h-4 w-4 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
      fill='none'
      xmlns='http://www.w3.org/2000/svg'
    >
      <path
        d='M4 6L8 10L12 6'
        stroke='currentColor'
        strokeWidth='1.8'
        strokeLinecap='round'
        strokeLinejoin='round'
      />
    </svg>
  );
}

function HamburgerIcon() {
  return (
    <svg
      aria-hidden='true'
      viewBox='0 0 24 24'
      className='h-5 w-5'
      fill='none'
      xmlns='http://www.w3.org/2000/svg'
    >
      <path
        d='M4 7H20M4 12H20M4 17H20'
        stroke={NAV_TEXT_COLOR}
        strokeWidth='2'
        strokeLinecap='round'
      />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg
      aria-hidden='true'
      viewBox='0 0 24 24'
      className='h-5 w-5'
      fill='none'
      xmlns='http://www.w3.org/2000/svg'
    >
      <path
        d='M6 6L18 18M18 6L6 18'
        stroke={NAV_TEXT_COLOR}
        strokeWidth='2'
        strokeLinecap='round'
      />
    </svg>
  );
}

interface LanguageSelectorButtonProps {
  className: string;
  currentLocale: Locale;
  currentPathname: string;
  languageSelector: LanguageSelectorContent;
  menuAlign?: 'left' | 'right';
}

function LanguageSelectorButton({
  className,
  currentLocale,
  currentPathname,
  languageSelector,
  menuAlign = 'right',
}: LanguageSelectorButtonProps) {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const languageMenuId = useId();
  const activeOption =
    languageSelector.options.find((option) => option.locale === currentLocale) ??
    languageSelector.options[0];

  useEffect(() => {
    if (!isMenuOpen) {
      return;
    }

    function handlePointerDown(event: MouseEvent | TouchEvent) {
      const target = event.target;
      if (!(target instanceof Node)) {
        return;
      }

      if (!wrapperRef.current?.contains(target)) {
        setIsMenuOpen(false);
      }
    }

    function handleEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setIsMenuOpen(false);
      }
    }

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('touchstart', handlePointerDown);
    window.addEventListener('keydown', handleEscape);

    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('touchstart', handlePointerDown);
      window.removeEventListener('keydown', handleEscape);
    };
  }, [isMenuOpen]);

  return (
    <div ref={wrapperRef} className='relative'>
      <button
        type='button'
        className={className}
        aria-controls={languageMenuId}
        aria-expanded={isMenuOpen}
        aria-haspopup='menu'
        onClick={() => {
          setIsMenuOpen((open) => !open);
        }}
      >
        <Image
          src={activeOption.flagSrc}
          alt=''
          aria-hidden='true'
          width={30}
          height={30}
          className='h-[30px] w-[30px] rounded-full object-cover'
        />
        <span style={localeStyle}>{activeOption.shortLabel}</span>
        <span className='sr-only'>
          {`${languageSelector.selectedLanguageAriaPrefix}: ${activeOption.label}`}
        </span>
        <LanguageChevronIcon isOpen={isMenuOpen} />
      </button>
      <ul
        id={languageMenuId}
        role='menu'
        aria-label={languageSelector.menuAriaLabel}
        className={`absolute ${menuAlign === 'left' ? 'left-0' : 'right-0'} top-[calc(100%+0.5rem)] z-[70] min-w-[230px] space-y-1 rounded-xl border border-black/10 bg-white p-2 shadow-xl transition ${isMenuOpen ? 'visible opacity-100' : 'invisible opacity-0'}`}
      >
        {languageSelector.options.map((option) => {
          const isCurrent = option.locale === currentLocale;
          return (
            <li key={option.locale}>
              <Link
                role='menuitem'
                href={localizePath(currentPathname, option.locale)}
                className='inline-flex w-full items-center gap-2 rounded-lg px-3 py-2 transition-colors hover:bg-[#FFF0E5] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-black/40'
                onClick={() => {
                  setIsMenuOpen(false);
                }}
                style={{
                  color: isCurrent ? NAV_ACTIVE_TEXT : NAV_TEXT_COLOR,
                  fontFamily:
                    'var(--figma-fontfamilies-lato, Lato), sans-serif',
                  fontSize: '16px',
                  fontWeight: isCurrent ? 700 : 500,
                  lineHeight: '1.25',
                }}
              >
                <Image
                  src={option.flagSrc}
                  alt={`${option.label} flag`}
                  width={22}
                  height={22}
                  className='h-[22px] w-[22px] rounded-full object-cover'
                />
                <span>{option.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function BookNowButton({
  className,
  href,
  label,
  onClick,
}: {
  className: string;
  href: string;
  label: string;
  onClick?: () => void;
}) {
  return (
    <Link href={href} className={className} style={ctaStyle} onClick={onClick}>
      {label}
    </Link>
  );
}

interface TopLevelMenuLinkProps {
  item: MenuItem;
  isActive: boolean;
  className: string;
  locale: Locale;
}

function TopLevelMenuLink({
  item,
  isActive,
  className,
  locale,
}: TopLevelMenuLinkProps) {
  return (
    <Link
      href={localizeHref(item.href, locale)}
      className={className}
      style={getTopLinkStyle(isActive)}
    >
      {item.label}
    </Link>
  );
}

interface SubmenuLinksProps {
  items: readonly SubmenuItem[];
  currentPath: string;
  listClassName: string;
  linkClassName: string;
  locale: Locale;
  onNavigate?: () => void;
}

function SubmenuLinks({
  items,
  currentPath,
  listClassName,
  linkClassName,
  locale,
  onNavigate,
}: SubmenuLinksProps) {
  return (
    <ul className={listClassName}>
      {items.map((item) => (
        <li key={item.label}>
          <Link
            href={localizeHref(item.href, locale)}
            className={linkClassName}
            style={getSubmenuLinkStyle(isHrefActive(currentPath, item.href))}
            onClick={onNavigate}
          >
            {item.label}
          </Link>
        </li>
      ))}
    </ul>
  );
}

function DesktopMenuItem({
  item,
  currentPath,
  locale,
}: {
  item: MenuItem;
  currentPath: string;
  locale: Locale;
}) {
  const itemIsActive = isMenuItemActive(currentPath, item);

  if (!item.children) {
    return (
      <li>
        <TopLevelMenuLink
          item={item}
          isActive={itemIsActive}
          locale={locale}
          className='inline-flex min-h-[42px] items-center justify-center rounded-[58.73px] px-[17px] transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-black/40'
        />
      </li>
    );
  }

  return (
    <li className='group relative'>
      <TopLevelMenuLink
        item={item}
        isActive={itemIsActive}
        locale={locale}
        className='inline-flex min-h-[42px] items-center justify-center rounded-[58.73px] px-[17px] pr-10 transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-black/40'
      />
      <span
        aria-hidden='true'
        className='pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-xs text-black/70 transition-transform group-hover:rotate-180'
      >
        v
      </span>
      <SubmenuLinks
        items={item.children}
        currentPath={currentPath}
        locale={locale}
        listClassName='invisible absolute left-0 top-[calc(100%+4px)] z-50 w-[192px] space-y-[3px] rounded-none bg-transparent p-0 opacity-0 shadow-[0_6px_14px_rgba(230,230,230,0.3)] transition group-hover:visible group-hover:opacity-100 group-focus-within:visible group-focus-within:opacity-100'
        linkClassName='inline-flex min-h-[40px] w-full items-center justify-start rounded-[6px] px-3 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-black/40'
      />
    </li>
  );
}

function DesktopMenuItems({
  items,
  currentPath,
  locale,
}: {
  items: readonly MenuItem[];
  currentPath: string;
  locale: Locale;
}) {
  return (
    <ul className='hidden flex-1 items-center justify-center gap-[6px] lg:flex'>
      {items.map((item) => (
        <DesktopMenuItem
          key={item.label}
          item={item}
          currentPath={currentPath}
          locale={locale}
        />
      ))}
    </ul>
  );
}

function MobileMenuItem({
  item,
  currentPath,
  locale,
  onNavigate,
}: {
  item: MenuItem;
  currentPath: string;
  locale: Locale;
  onNavigate: () => void;
}) {
  const itemIsActive = isMenuItemActive(currentPath, item);
  const [isExpanded, setIsExpanded] = useState(itemIsActive);

  useEffect(() => {
    setIsExpanded(itemIsActive);
  }, [itemIsActive]);

  return (
    <li className='rounded-xl border border-black/10 bg-white/35 px-3 py-2'>
      <div className='flex items-center gap-2'>
        <Link
          href={localizeHref(item.href, locale)}
          className='inline-flex min-h-[40px] flex-1 items-center'
          onClick={onNavigate}
          style={{
            color: itemIsActive ? NAV_ACTIVE_TEXT : NAV_TEXT_COLOR,
            fontFamily: 'var(--figma-fontfamilies-lato, Lato), sans-serif',
            fontSize: '18px',
            fontWeight: 500,
            lineHeight: '22px',
          }}
        >
          {item.label}
        </Link>
        {item.children && (
          <button
            type='button'
            onClick={() => {
              setIsExpanded((value) => !value);
            }}
            aria-expanded={isExpanded}
            aria-label={`Toggle ${item.label} submenu`}
            className='inline-flex h-8 w-8 items-center justify-center rounded-full text-black/70 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-black/40'
          >
            <MobileChevronIcon isExpanded={isExpanded} />
          </button>
        )}
      </div>
      {item.children && (
        <SubmenuLinks
          items={item.children}
          currentPath={currentPath}
          locale={locale}
          onNavigate={onNavigate}
          listClassName={`overflow-hidden pl-4 transition-all ${isExpanded ? 'mt-2 max-h-[480px] space-y-2 opacity-100' : 'max-h-0 space-y-0 opacity-0'}`}
          linkClassName='inline-flex min-h-[36px] w-full items-center rounded-md px-2'
        />
      )}
    </li>
  );
}

function MobileMenuItems({
  items,
  currentPath,
  locale,
  onNavigate,
}: {
  items: readonly MenuItem[];
  currentPath: string;
  locale: Locale;
  onNavigate: () => void;
}) {
  return (
    <ul className='space-y-3'>
      {items.map((item) => (
        <MobileMenuItem
          key={item.label}
          item={item}
          currentPath={currentPath}
          locale={locale}
          onNavigate={onNavigate}
        />
      ))}
    </ul>
  );
}

export function Navbar({ content }: NavbarProps) {
  const pathname = usePathname() ?? '/';
  const currentPath = normalizePath(pathname);
  const currentLocale = getLocaleFromPath(pathname);
  const logoSrc = content.logoSrc || LOGO_SRC;
  const localizedHomeHref = localizePath('/', currentLocale);
  const localizedBookNowHref = localizeHref(content.bookNow.href, currentLocale);
  const languageSelector = resolveLanguageSelectorContent(content);
  const [mobileMenuOpenForPath, setMobileMenuOpenForPath] = useState<
    string | null
  >(null);
  const isMobileMenuOpen = mobileMenuOpenForPath === pathname;
  const mobileMenuButtonRef = useRef<HTMLButtonElement | null>(null);
  const mobileMenuCloseButtonRef = useRef<HTMLButtonElement | null>(null);
  const mobileNavigationDrawerRef = useRef<HTMLElement | null>(null);
  const wasMobileMenuOpenRef = useRef(false);

  useEffect(() => {
    if (!isMobileMenuOpen) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [isMobileMenuOpen]);

  useEffect(() => {
    if (!isMobileMenuOpen) {
      return;
    }

    mobileMenuCloseButtonRef.current?.focus();

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setMobileMenuOpenForPath(null);
        return;
      }

      if (event.key !== 'Tab') {
        return;
      }

      const drawerElement = mobileNavigationDrawerRef.current;
      if (!drawerElement) {
        return;
      }

      const focusableElements = getFocusableElements(drawerElement);
      if (focusableElements.length === 0) {
        event.preventDefault();
        return;
      }

      const firstElement = focusableElements[0];
      const lastElement = focusableElements[focusableElements.length - 1];
      const activeElement = document.activeElement;

      if (event.shiftKey) {
        if (
          activeElement === firstElement ||
          !drawerElement.contains(activeElement)
        ) {
          event.preventDefault();
          lastElement.focus();
        }

        return;
      }

      if (activeElement === lastElement) {
        event.preventDefault();
        firstElement.focus();
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isMobileMenuOpen]);

  useEffect(() => {
    if (isMobileMenuOpen) {
      wasMobileMenuOpenRef.current = true;
      return;
    }

    if (wasMobileMenuOpenRef.current) {
      mobileMenuButtonRef.current?.focus();
      wasMobileMenuOpenRef.current = false;
    }
  }, [isMobileMenuOpen]);

  return (
    <>
      <header
        data-figma-node='navbar'
        className='w-full border-b border-black/5'
        style={{ backgroundColor: NAV_BACKGROUND }}
      >
        <nav className='mx-auto flex w-full max-w-[1465px] items-center justify-between gap-3 px-4 py-4 sm:px-6 lg:min-h-[115px] lg:px-8 lg:py-0'>
          <Link href={localizedHomeHref} className='shrink-0'>
            <Image
              src={logoSrc}
              alt={content.brand}
              width={150}
              height={44}
              className='h-[34px] w-auto sm:h-[40px] lg:h-[44px]'
            />
          </Link>

          <DesktopMenuItems
            items={content.menuItems}
            currentPath={currentPath}
            locale={currentLocale}
          />

          <div className='hidden items-center gap-3 lg:flex'>
            <LanguageSelectorButton
              key={`desktop-language-${pathname}`}
              currentLocale={currentLocale}
              currentPathname={pathname}
              languageSelector={languageSelector}
              className='inline-flex h-[30px] items-center gap-[9px] px-[6px]'
            />
            <BookNowButton
              href={localizedBookNowHref}
              label={content.bookNow.label}
              className='inline-flex h-[56px] items-center justify-center rounded-[10px] px-[27px] text-center transition-opacity hover:opacity-95'
            />
          </div>

          <button
            ref={mobileMenuButtonRef}
            type='button'
            aria-controls='mobile-navigation-drawer'
            aria-expanded={isMobileMenuOpen}
            aria-haspopup='dialog'
            aria-label='Open navigation menu'
            onClick={() => {
              setMobileMenuOpenForPath(pathname);
            }}
            className='inline-flex h-11 w-11 items-center justify-center rounded-xl border border-black/10 bg-white/80 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-black/40 lg:hidden'
          >
            <span className='sr-only'>Open navigation menu</span>
            <HamburgerIcon />
          </button>
        </nav>
      </header>
      {isMobileMenuOpen && (
        <div className='fixed inset-0 z-[60] lg:hidden'>
          <button
            type='button'
            tabIndex={-1}
            aria-label='Close navigation menu'
            className='absolute inset-0 bg-black/35'
            onClick={() => {
              setMobileMenuOpenForPath(null);
            }}
          />
          <aside
            id='mobile-navigation-drawer'
            ref={mobileNavigationDrawerRef}
            role='dialog'
            aria-modal='true'
            aria-label='Mobile navigation menu'
            className={`absolute inset-y-0 right-0 ${MOBILE_PANEL_WIDTH_CLASS} flex flex-col border-l border-black/10 shadow-2xl`}
            style={{ backgroundColor: NAV_BACKGROUND }}
          >
            <div className='flex items-center justify-between border-b border-black/10 px-4 py-4'>
              <Link
                href={localizedHomeHref}
                className='shrink-0'
                onClick={() => {
                  setMobileMenuOpenForPath(null);
                }}
              >
                <Image
                  src={logoSrc}
                  alt={content.brand}
                  width={120}
                  height={36}
                  className='h-[34px] w-auto'
                />
              </Link>
              <button
                ref={mobileMenuCloseButtonRef}
                type='button'
                aria-label='Close navigation menu'
                onClick={() => {
                  setMobileMenuOpenForPath(null);
                }}
                className='inline-flex h-10 w-10 items-center justify-center rounded-full border border-black/10 bg-white/60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-black/40'
              >
                <CloseIcon />
              </button>
            </div>
            <div className='flex-1 overflow-y-auto p-4'>
              <MobileMenuItems
                items={content.menuItems}
                currentPath={currentPath}
                locale={currentLocale}
                onNavigate={() => {
                  setMobileMenuOpenForPath(null);
                }}
              />
              <div className='mt-6 space-y-4 border-t border-black/10 pt-4'>
                <LanguageSelectorButton
                  key={`mobile-language-${pathname}`}
                  currentLocale={currentLocale}
                  currentPathname={pathname}
                  languageSelector={languageSelector}
                  menuAlign='left'
                  className='inline-flex h-[36px] w-full items-center gap-[9px] px-[6px]'
                />
                <BookNowButton
                  href={localizedBookNowHref}
                  label={content.bookNow.label}
                  onClick={() => {
                    setMobileMenuOpenForPath(null);
                  }}
                  className='inline-flex h-[56px] w-full items-center justify-center rounded-[10px] px-6 text-center'
                />
              </div>
            </div>
          </aside>
        </div>
      )}
    </>
  );
}
