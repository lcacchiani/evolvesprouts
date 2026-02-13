'use client';

import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  type CSSProperties,
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
} from 'react';

import { SectionCtaAnchor } from '@/components/section-cta-link';
import {
  CloseIcon,
  HamburgerIcon,
  LanguageChevronIcon,
  MobileChevronIcon,
} from '@/components/sections/navbar-icons';
import {
  type Locale,
  type NavbarContent,
} from '@/content';
import { HEADING_TEXT_COLOR } from '@/lib/design-tokens';
import { useOutsideClickClose } from '@/lib/hooks/use-outside-click-close';
import {
  getLocaleFromPath,
  isSupportedLocale,
  localizeHref,
  localizePath,
  normalizeLocalizedPath,
} from '@/lib/locale-routing';

interface NavbarProps {
  content: NavbarContent;
}

type MenuItem = NavbarContent['menuItems'][number];
type SubmenuItem = NonNullable<MenuItem['children']>[number];

const NAV_BACKGROUND = '#fff';
const NAV_PILL_BACKGROUND = 'var(--figma-colors-frame-2147235267, #F6DECD)';
const NAV_TEXT_COLOR = HEADING_TEXT_COLOR;
const NAV_ACTIVE_TEXT = '#C84A16';
const NAV_ACTIVE_BACKGROUND = '#F2A975';
const LOGO_SRC = '/images/evolvesprouts-logo.svg';
const MOBILE_PANEL_WIDTH_CLASS = 'w-[min(88vw,360px)]';
const MOBILE_MENU_TRANSITION_MS = 300;
const FOCUSABLE_ELEMENT_SELECTOR =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';
const NAV_TOP_LEVEL_LINK_CLASSNAME =
  'es-focus-ring es-nav-pill justify-center transition-colors';
const NAV_TOP_LEVEL_LINK_WITH_SUBMENU_CLASSNAME =
  `${NAV_TOP_LEVEL_LINK_CLASSNAME} pr-10`;
const NAV_SUBMENU_LINK_CLASSNAME =
  'es-focus-ring es-nav-submenu-link';
const NAV_MOBILE_TOP_LEVEL_LINK_CLASSNAME =
  'es-focus-ring es-nav-pill flex-1';
const NAV_MOBILE_PRIMARY_ACTION_CLASSNAME =
  'es-focus-ring es-nav-pill w-full justify-between transition-colors';
const NAV_MOBILE_BOOK_BUTTON_CLASSNAME =
  'w-full rounded-[10px] px-4';
const NAV_LANGUAGE_OPTION_CLASSNAME =
  'es-focus-ring es-nav-language-option';
const NAV_DESKTOP_BOOK_BUTTON_CLASSNAME =
  'h-[56px] rounded-[10px] px-[27px]';
const NAV_OPEN_MENU_BUTTON_CLASSNAME =
  'es-focus-ring es-nav-icon-button h-11 w-11 rounded-xl lg:hidden';
const NAV_CLOSE_MENU_BUTTON_CLASSNAME =
  'es-focus-ring es-nav-icon-button h-10 w-10 rounded-full';

const linkStyle = {
  backgroundColor: NAV_PILL_BACKGROUND,
  color: NAV_TEXT_COLOR,
  fontFamily: 'var(--figma-fontfamilies-lato, Lato), sans-serif',
  fontSize: 'var(--figma-fontsizes-18, 18px)',
  fontWeight: 'var(--figma-fontweights-600, 600)',
  lineHeight: 'var(--figma-lineheights-home-2, 100%)',
};

const ctaStyle = {
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
    flagSrc: '/images/flags/gb.png',
  },
  {
    locale: 'zh-CN',
    label: 'Chinese (Simplified)',
    shortLabel: 'SC',
    flagSrc: '/images/flags/cn.png',
  },
  {
    locale: 'zh-HK',
    label: 'Chinese (Traditional)',
    shortLabel: 'TC',
    flagSrc: '/images/flags/hk.png',
  },
];

const DEFAULT_LANGUAGE_MENU_ARIA_LABEL = 'Select language';
const DEFAULT_SELECTED_LANGUAGE_ARIA_PREFIX = 'Selected language';

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
      if (!isSupportedLocale(option.locale)) {
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
  const targetPath = normalizeLocalizedPath(href);

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

interface LanguageSelectorButtonProps {
  className: string;
  currentLocale: Locale;
  currentPathname: string;
  languageSelector: LanguageSelectorContent;
  menuAlign?: 'left' | 'right';
  buttonStyle?: Record<string, string | number>;
  isBorderlessMenu?: boolean;
}

function LanguageSelectorButton({
  className,
  currentLocale,
  currentPathname,
  languageSelector,
  menuAlign = 'right',
  buttonStyle,
  isBorderlessMenu = false,
}: LanguageSelectorButtonProps) {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const languageMenuId = useId();
  const closeMenu = useCallback(() => {
    setIsMenuOpen(false);
  }, [setIsMenuOpen]);
  const activeOption =
    languageSelector.options.find((option) => option.locale === currentLocale) ??
    languageSelector.options[0];

  useOutsideClickClose({
    ref: wrapperRef,
    onOutsideClick: closeMenu,
    isActive: isMenuOpen,
  });

  useEffect(() => {
    if (!isMenuOpen) {
      return;
    }

    function handleEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        closeMenu();
      }
    }

    window.addEventListener('keydown', handleEscape);

    return () => {
      window.removeEventListener('keydown', handleEscape);
    };
  }, [closeMenu, isMenuOpen]);

  return (
    <div ref={wrapperRef} className='relative'>
      <button
        type='button'
        className={className}
        style={buttonStyle}
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
        <span className='sr-only'>
          {`${languageSelector.selectedLanguageAriaPrefix}: ${activeOption.label}`}
        </span>
        <LanguageChevronIcon isOpen={isMenuOpen} />
      </button>
      <ul
        id={languageMenuId}
        role='menu'
        aria-label={languageSelector.menuAriaLabel}
        aria-hidden={!isMenuOpen}
        className={`absolute ${menuAlign === 'left' ? 'left-0' : 'right-0'} top-[calc(100%+0.5rem)] z-[70] min-w-[230px] space-y-1 rounded-xl bg-white p-2 shadow-xl transition-opacity duration-200 ease-out ${isBorderlessMenu ? '' : 'border border-black/10'} ${isMenuOpen ? 'pointer-events-auto opacity-100' : 'pointer-events-none opacity-0'}`}
      >
        {languageSelector.options.map((option) => {
          const isCurrent = option.locale === currentLocale;
          return (
            <li key={option.locale}>
              <Link
                role='menuitem'
                href={localizePath(currentPathname, option.locale)}
                className={NAV_LANGUAGE_OPTION_CLASSNAME}
                onClick={() => {
                  closeMenu();
                }}
                tabIndex={isMenuOpen ? undefined : -1}
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
  style = ctaStyle,
}: {
  className: string;
  href: string;
  label: string;
  onClick?: () => void;
  style?: CSSProperties;
}) {
  return (
    <SectionCtaAnchor
      href={href}
      className={className}
      style={style}
      onClick={onClick}
    >
      {label}
    </SectionCtaAnchor>
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
  id?: string;
  isOpen?: boolean;
}

function SubmenuLinks({
  items,
  currentPath,
  listClassName,
  linkClassName,
  locale,
  onNavigate,
  id,
  isOpen,
}: SubmenuLinksProps) {
  return (
    <ul
      id={id}
      className={listClassName}
      aria-hidden={isOpen === false ? true : undefined}
    >
      {items.map((item) => (
        <li key={item.label}>
          <Link
            href={localizeHref(item.href, locale)}
            className={linkClassName}
            style={getSubmenuLinkStyle(isHrefActive(currentPath, item.href))}
            onClick={onNavigate}
            tabIndex={isOpen === false ? -1 : undefined}
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
  const hasChildren = Boolean(item.children);

  const [isSubmenuOpen, setIsSubmenuOpen] = useState(false);
  const submenuListId = useId();
  const submenuWrapperRef = useRef<HTMLLIElement | null>(null);
  const closeSubmenu = useCallback(() => {
    setIsSubmenuOpen(false);
  }, [setIsSubmenuOpen]);

  useOutsideClickClose({
    ref: submenuWrapperRef,
    onOutsideClick: closeSubmenu,
    isActive: hasChildren && isSubmenuOpen,
  });

  useEffect(() => {
    if (!hasChildren || !isSubmenuOpen) {
      return;
    }

    function handleEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        closeSubmenu();
      }
    }

    window.addEventListener('keydown', handleEscape);

    return () => {
      window.removeEventListener('keydown', handleEscape);
    };
  }, [closeSubmenu, hasChildren, isSubmenuOpen]);

  if (!item.children) {
    return (
      <li>
        <TopLevelMenuLink
          item={item}
          isActive={itemIsActive}
          locale={locale}
          className={NAV_TOP_LEVEL_LINK_CLASSNAME}
        />
      </li>
    );
  }

  return (
    <li
      ref={submenuWrapperRef}
      className='relative'
      onMouseEnter={() => {
        setIsSubmenuOpen(true);
      }}
      onMouseLeave={() => {
        closeSubmenu();
      }}
    >
      <button
        type='button'
        className={NAV_TOP_LEVEL_LINK_WITH_SUBMENU_CLASSNAME}
        style={getTopLinkStyle(itemIsActive)}
        aria-expanded={isSubmenuOpen}
        aria-controls={submenuListId}
        aria-label={`Toggle ${item.label} submenu`}
        onClick={() => {
          setIsSubmenuOpen((value) => !value);
        }}
      >
        {item.label}
      </button>
      <span
        aria-hidden='true'
        className={`pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 transition-transform ${isSubmenuOpen ? 'rotate-180' : ''}`}
      >
        <LanguageChevronIcon />
      </span>
      <SubmenuLinks
        items={item.children}
        currentPath={currentPath}
        locale={locale}
        onNavigate={() => {
          closeSubmenu();
        }}
        id={submenuListId}
        isOpen={isSubmenuOpen}
        listClassName={`absolute left-0 top-full z-50 w-[192px] space-y-[3px] rounded-none bg-transparent pt-1 shadow-[0_6px_14px_rgba(230,230,230,0.3)] transition-opacity duration-200 ease-out ${isSubmenuOpen ? 'pointer-events-auto opacity-100' : 'pointer-events-none opacity-0'}`}
        linkClassName={NAV_SUBMENU_LINK_CLASSNAME}
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
    <li className='space-y-2'>
      {item.children ? (
        <button
          type='button'
          onClick={() => {
            setIsExpanded((value) => !value);
          }}
          aria-expanded={isExpanded}
          aria-label={`Toggle ${item.label} submenu`}
          className={NAV_MOBILE_PRIMARY_ACTION_CLASSNAME}
          style={getTopLinkStyle(itemIsActive)}
        >
          <span>{item.label}</span>
          <MobileChevronIcon isExpanded={isExpanded} />
        </button>
      ) : (
        <Link
          href={localizeHref(item.href, locale)}
          className={NAV_MOBILE_TOP_LEVEL_LINK_CLASSNAME}
          onClick={onNavigate}
          style={getTopLinkStyle(itemIsActive)}
        >
          {item.label}
        </Link>
      )}
      {item.children && (
        <SubmenuLinks
          items={item.children}
          currentPath={currentPath}
          locale={locale}
          onNavigate={onNavigate}
          listClassName={`overflow-hidden pl-4 transition-all duration-300 ${isExpanded ? 'max-h-[480px] space-y-2 pt-1 opacity-100' : 'max-h-0 space-y-0 pt-0 opacity-0'}`}
          linkClassName={NAV_SUBMENU_LINK_CLASSNAME}
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
  const currentPath = normalizeLocalizedPath(pathname);
  const currentLocale = getLocaleFromPath(pathname);
  const logoSrc = content.logoSrc || LOGO_SRC;
  const localizedHomeHref = localizePath('/', currentLocale);
  const localizedBookNowHref = localizeHref(content.bookNow.href, currentLocale);
  const languageSelector = resolveLanguageSelectorContent(content);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isMobileMenuRendered, setIsMobileMenuRendered] = useState(false);
  const mobileMenuButtonRef = useRef<HTMLButtonElement | null>(null);
  const mobileMenuCloseButtonRef = useRef<HTMLButtonElement | null>(null);
  const mobileNavigationDrawerRef = useRef<HTMLElement | null>(null);
  const openMenuFrameRef = useRef<number | null>(null);
  const closeMenuTimeoutRef = useRef<number | null>(null);
  const wasMobileMenuOpenRef = useRef(false);

  const clearMobileMenuOpenFrame = useCallback(() => {
    if (openMenuFrameRef.current === null) {
      return;
    }

    window.cancelAnimationFrame(openMenuFrameRef.current);
    openMenuFrameRef.current = null;
  }, []);

  const clearMobileMenuCloseTimeout = useCallback(() => {
    if (closeMenuTimeoutRef.current === null) {
      return;
    }

    window.clearTimeout(closeMenuTimeoutRef.current);
    closeMenuTimeoutRef.current = null;
  }, []);

  const openMobileMenu = useCallback(() => {
    clearMobileMenuOpenFrame();
    clearMobileMenuCloseTimeout();
    setIsMobileMenuRendered(true);

    openMenuFrameRef.current = window.requestAnimationFrame(() => {
      setIsMobileMenuOpen(true);
      openMenuFrameRef.current = null;
    });
  }, [clearMobileMenuCloseTimeout, clearMobileMenuOpenFrame]);

  const closeMobileMenu = useCallback(() => {
    clearMobileMenuOpenFrame();
    setIsMobileMenuOpen(false);
    clearMobileMenuCloseTimeout();
    closeMenuTimeoutRef.current = window.setTimeout(() => {
      setIsMobileMenuRendered(false);
      closeMenuTimeoutRef.current = null;
    }, MOBILE_MENU_TRANSITION_MS);
  }, [clearMobileMenuCloseTimeout, clearMobileMenuOpenFrame]);

  useEffect(() => {
    return () => {
      clearMobileMenuOpenFrame();
      clearMobileMenuCloseTimeout();
    };
  }, [clearMobileMenuCloseTimeout, clearMobileMenuOpenFrame]);

  useEffect(() => {
    if (!isMobileMenuRendered) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [isMobileMenuRendered]);

  useEffect(() => {
    if (!isMobileMenuOpen) {
      return;
    }

    mobileMenuCloseButtonRef.current?.focus();

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        closeMobileMenu();
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
  }, [closeMobileMenu, isMobileMenuOpen]);

  useEffect(() => {
    if (isMobileMenuRendered) {
      wasMobileMenuOpenRef.current = true;
      return;
    }

    if (wasMobileMenuOpenRef.current) {
      mobileMenuButtonRef.current?.focus();
      wasMobileMenuOpenRef.current = false;
    }
  }, [isMobileMenuRendered]);

  return (
    <>
      <header
        data-figma-node='navbar'
        className='w-full'
        style={{ backgroundColor: NAV_BACKGROUND }}
      >
        <nav className='mx-auto flex w-full max-w-[1465px] items-center justify-between gap-3 px-4 py-4 sm:px-6 lg:min-h-[115px] lg:px-8 lg:py-0'>
          <Link href={localizedHomeHref} className='shrink-0'>
            <Image
              src={logoSrc}
              alt={content.brand}
              width={150}
              height={150}
              className='h-[150px] w-[150px] bg-[#fff] object-contain'
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
              className={NAV_DESKTOP_BOOK_BUTTON_CLASSNAME}
            />
          </div>

          <button
            ref={mobileMenuButtonRef}
            type='button'
            aria-controls='mobile-navigation-drawer'
            aria-expanded={isMobileMenuOpen}
            aria-haspopup='dialog'
            aria-label='Open navigation menu'
            onClick={openMobileMenu}
            className={NAV_OPEN_MENU_BUTTON_CLASSNAME}
          >
            <span className='sr-only'>Open navigation menu</span>
            <HamburgerIcon />
          </button>
        </nav>
      </header>
      {isMobileMenuRendered && (
        <div className='fixed inset-0 z-[60] lg:hidden'>
          <button
            type='button'
            tabIndex={-1}
            aria-label='Close navigation menu'
            className={`absolute inset-0 bg-black/35 transition-opacity duration-300 ${isMobileMenuOpen ? 'opacity-100' : 'opacity-0'}`}
            onClick={closeMobileMenu}
          />
          <aside
            id='mobile-navigation-drawer'
            ref={mobileNavigationDrawerRef}
            role='dialog'
            aria-modal='true'
            aria-label='Mobile navigation menu'
            className={`absolute inset-y-0 right-0 ${MOBILE_PANEL_WIDTH_CLASS} flex flex-col shadow-2xl transition-transform duration-300 ease-out ${isMobileMenuOpen ? 'translate-x-0' : 'translate-x-full'}`}
            style={{ backgroundColor: NAV_BACKGROUND }}
          >
            <div className='flex items-center justify-between px-4 py-4'>
              <Link
                href={localizedHomeHref}
                className='shrink-0'
                onClick={closeMobileMenu}
              >
                <Image
                  src={logoSrc}
                  alt={content.brand}
                  width={150}
                  height={150}
                  className='h-[150px] w-[150px] bg-[#fff] object-contain'
                />
              </Link>
              <button
                ref={mobileMenuCloseButtonRef}
                type='button'
                aria-label='Close navigation menu'
                onClick={closeMobileMenu}
                className={NAV_CLOSE_MENU_BUTTON_CLASSNAME}
              >
                <CloseIcon />
              </button>
            </div>
            <div className='flex-1 overflow-y-auto p-4'>
              <MobileMenuItems
                items={content.menuItems}
                currentPath={currentPath}
                locale={currentLocale}
                onNavigate={closeMobileMenu}
              />
              <div className='mt-6 space-y-4 pt-4'>
                <LanguageSelectorButton
                  key={`mobile-language-${pathname}`}
                  currentLocale={currentLocale}
                  currentPathname={pathname}
                  languageSelector={languageSelector}
                  menuAlign='left'
                  className={NAV_MOBILE_PRIMARY_ACTION_CLASSNAME}
                  buttonStyle={getTopLinkStyle(false)}
                  isBorderlessMenu
                />
                <BookNowButton
                  href={localizedBookNowHref}
                  label={content.bookNow.label}
                  onClick={closeMobileMenu}
                  className={NAV_MOBILE_BOOK_BUTTON_CLASSNAME}
                />
              </div>
            </div>
          </aside>
        </div>
      )}
    </>
  );
}
