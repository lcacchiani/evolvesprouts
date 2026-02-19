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

import { ButtonPrimitive } from '@/components/shared/button-primitive';
import {
  OverlayBackdrop,
  OverlayDrawerPanel,
} from '@/components/shared/overlay-surface';
import { SectionCtaAnchor } from '@/components/sections/shared/section-cta-link';
import { SectionContainer } from '@/components/sections/shared/section-container';
import {
  LanguageSelectorButton,
  resolveLanguageSelectorContent,
} from '@/components/sections/navbar/language-selector';
import {
  DesktopMenuItems,
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
import { ROUTES } from '@/lib/routes';

interface NavbarProps {
  content: NavbarContent;
}

const LOGO_SRC = '/images/evolvesprouts-logo.svg';
const NAV_HAMBURGER_ICON_SRC = '/images/hamburger.svg';
const NAV_CLOSE_ICON_SRC = '/images/close.svg';
const MOBILE_PANEL_WIDTH_CLASS = 'w-[min(88vw,360px)]';
const MOBILE_MENU_TRANSITION_MS = 300;
const FOCUSABLE_ELEMENT_SELECTOR =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';
const NAV_MOBILE_BOOK_BUTTON_CLASSNAME =
  'w-full';
const NAV_OPEN_MENU_BUTTON_CLASSNAME =
  'h-11 w-11 rounded-xl lg:hidden';
const NAV_CLOSE_MENU_BUTTON_CLASSNAME =
  'h-10 w-10 rounded-full';

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
  const localizedHomeHref = localizePath(ROUTES.home, currentLocale);
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
        className='relative z-30 es-navbar-surface w-full'
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
              className='h-[30px] gap-[9px] px-[6px]'
            />
            <BookNowButton
              href={localizedBookNowHref}
              label={content.bookNow.label}
            />
          </div>

          <ButtonPrimitive
            variant='icon'
            buttonRef={mobileMenuButtonRef}
            aria-controls='mobile-navigation-drawer'
            aria-expanded={isMobileMenuOpen}
            aria-haspopup='dialog'
            aria-label='Open navigation menu'
            onClick={openMobileMenu}
            className={NAV_OPEN_MENU_BUTTON_CLASSNAME}
          >
            <span className='sr-only'>Open navigation menu</span>
            <Image
              src={NAV_HAMBURGER_ICON_SRC}
              alt=''
              aria-hidden='true'
              width={16}
              height={16}
              className='h-4 w-4'
            />
          </ButtonPrimitive>
        </SectionContainer>
      </header>
      {isMobileMenuRendered && (
        <div className='fixed inset-0 z-[60] lg:hidden'>
          <OverlayBackdrop
            tabIndex={-1}
            ariaLabel='Close navigation menu'
            className={`absolute inset-0 bg-black/35 transition-opacity duration-300 ${isMobileMenuOpen ? 'opacity-100' : 'opacity-0'}`}
            onClick={closeMobileMenu}
          />
          <OverlayDrawerPanel
            isOpen={isMobileMenuOpen}
            id='mobile-navigation-drawer'
            panelRef={mobileNavigationDrawerRef}
            role='dialog'
            aria-modal='true'
            aria-label='Mobile navigation menu'
            className={`${MOBILE_PANEL_WIDTH_CLASS} es-navbar-surface`}
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
              <ButtonPrimitive
                variant='icon'
                buttonRef={mobileMenuCloseButtonRef}
                aria-label='Close navigation menu'
                onClick={closeMobileMenu}
                className={NAV_CLOSE_MENU_BUTTON_CLASSNAME}
              >
                <Image
                  src={NAV_CLOSE_ICON_SRC}
                  alt=''
                  aria-hidden='true'
                  width={18}
                  height={18}
                  className='h-[18px] w-[18px]'
                />
              </ButtonPrimitive>
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
                  buttonVariant='pill'
                  buttonState='inactive'
                  className={MOBILE_PRIMARY_ACTION_CLASSNAME}
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
          </OverlayDrawerPanel>
        </div>
      )}
    </>
  );
}
