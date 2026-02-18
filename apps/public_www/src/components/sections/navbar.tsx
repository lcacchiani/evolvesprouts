'use client';

import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';

import { SectionCtaAnchor } from '@/components/section-cta-link';
import { SectionContainer } from '@/components/section-container';
import {
  CloseIcon,
  HamburgerIcon,
} from '@/components/sections/navbar-icons';
import {
  LanguageSelectorButton,
  resolveLanguageSelectorContent,
} from '@/components/sections/navbar/language-selector';
import {
  DesktopMenuItems,
  getTopLinkStyle,
  MOBILE_PRIMARY_ACTION_CLASSNAME,
  MobileMenuItems,
} from '@/components/sections/navbar/menu-items';
import {
  type NavbarContent,
} from '@/content';
import { useModalLockBody } from '@/lib/hooks/use-modal-lock-body';
import {
  getLocaleFromPath,
  localizeHref,
  localizePath,
  normalizeLocalizedPath,
} from '@/lib/locale-routing';

interface NavbarProps {
  content: NavbarContent;
}

const NAV_BACKGROUND = 'var(--es-color-surface-white, #FFFFFF)';
const LOGO_SRC = '/images/evolvesprouts-logo.svg';
const MOBILE_PANEL_WIDTH_CLASS = 'w-[min(88vw,360px)]';
const MOBILE_MENU_TRANSITION_MS = 300;
const FOCUSABLE_ELEMENT_SELECTOR =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';
const NAV_MOBILE_BOOK_BUTTON_CLASSNAME =
  'w-full';
const NAV_OPEN_MENU_BUTTON_CLASSNAME =
  'es-focus-ring es-nav-icon-button h-11 w-11 rounded-xl lg:hidden';
const NAV_CLOSE_MENU_BUTTON_CLASSNAME =
  'es-focus-ring es-nav-icon-button h-10 w-10 rounded-full';

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

function BookNowButton({
  className,
  href,
  label,
  onClick,
}: {
  className?: string;
  href: string;
  label: string;
  onClick?: () => void;
}) {
  return (
    <SectionCtaAnchor
      href={href}
      className={className}
      onClick={onClick}
    >
      {label}
    </SectionCtaAnchor>
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

  useModalLockBody({
    isActive: isMobileMenuRendered,
    onEscape: closeMobileMenu,
  });

  useEffect(() => {
    return () => {
      clearMobileMenuOpenFrame();
      clearMobileMenuCloseTimeout();
    };
  }, [clearMobileMenuCloseTimeout, clearMobileMenuOpenFrame]);

  useEffect(() => {
    if (!isMobileMenuOpen) {
      return;
    }

    mobileMenuCloseButtonRef.current?.focus();

    function handleKeyDown(event: KeyboardEvent) {
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
        <SectionContainer
          as='nav'
          className='flex items-center justify-between gap-3 px-4 py-4 sm:px-6 lg:min-h-[115px] lg:px-8 lg:py-0'
        >
          <Link href={localizedHomeHref} className='shrink-0'>
            <Image
              src={logoSrc}
              alt={content.brand}
              width={150}
              height={150}
              className='h-[150px] w-[150px] es-bg-surface-white object-contain'
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
        </SectionContainer>
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
                  className='h-[150px] w-[150px] es-bg-surface-white object-contain'
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
                  className={MOBILE_PRIMARY_ACTION_CLASSNAME}
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
