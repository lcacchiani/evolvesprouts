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
} from '@/components/sections/navbar/desktop-menu-items';
import {
  MobileMenuItems,
} from '@/components/sections/navbar/mobile-menu-items';
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
const NAV_CLOSE_ICON_SRC = '/images/close.svg';
const MOBILE_PANEL_WIDTH_CLASS = 'w-[min(88vw,360px)]';
const MOBILE_MENU_TRANSITION_MS = 300;
const NAVBAR_CONDENSE_SCROLL_Y = 24;
const NAVBAR_EXPAND_SCROLL_Y = 8;
const FOCUSABLE_ELEMENT_SELECTOR =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';
const NAV_MOBILE_TOPBAR_BOOK_BUTTON_CLASSNAME =
  'shrink-0';
const NAV_MOBILE_CONTROL_BASE_CLASSNAME = 'border es-border-soft es-text-brand';
const NAV_MOBILE_DRAWER_LANGUAGE_BUTTON_CLASSNAME =
  `${NAV_MOBILE_CONTROL_BASE_CLASSNAME} bg-transparent h-11 gap-2 rounded-[14px] px-2.5`;
const NAV_MOBILE_DRAWER_BOOK_BUTTON_CLASSNAME = 'mt-6 w-full';
const NAV_OPEN_MENU_BUTTON_CLASSNAME =
  `${NAV_MOBILE_CONTROL_BASE_CLASSNAME} bg-[#F6DECD] h-11 w-11 rounded-[14px]`;
const NAV_HAMBURGER_ICON_CLASSNAME = 'es-navbar-hamburger-icon h-4 w-4';
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

function resolveBookNowHref(bookNow: NavbarContent['bookNow']): string {
  if (
    'href' in bookNow
    && typeof bookNow.href === 'string'
    && bookNow.href.trim() !== ''
  ) {
    return bookNow.href;
  }

  return ROUTES.servicesMyBestAuntieTrainingCourse;
}

export function Navbar({ content }: NavbarProps) {
  const pathname = usePathname() ?? '/';
  const currentPath = normalizeLocalizedPath(pathname);
  const currentLocale = getLocaleFromPath(pathname);
  const logoSrc = content.logoSrc || LOGO_SRC;
  const localizedHomeHref = localizePath(ROUTES.home, currentLocale);
  const localizedBookNowHref = localizeHref(
    resolveBookNowHref(content.bookNow),
    currentLocale,
  );
  const languageSelector = resolveLanguageSelectorContent(content);
  const openNavigationMenuAriaLabel = content.openNavigationMenuAriaLabel.trim();
  const closeNavigationMenuAriaLabel = content.closeNavigationMenuAriaLabel.trim();
  const mobileNavigationMenuAriaLabel = content.mobileNavigationMenuAriaLabel.trim();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isMobileMenuRendered, setIsMobileMenuRendered] = useState(false);
  const headerRef = useRef<HTMLElement | null>(null);
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

  useEffect(() => {
    let scrollFrame: number | null = null;
    let isCondensed = false;
    const headerElement = headerRef.current;
    const applyCondensedState = (condensed: boolean) => {
      if (condensed === isCondensed) {
        return;
      }

      isCondensed = condensed;
      headerElement?.classList.toggle('es-navbar--condensed', condensed);
    };
    const resolveCondensedFromScroll = () => {
      const scrollY = window.scrollY;
      if (isCondensed) {
        return scrollY > NAVBAR_EXPAND_SCROLL_Y;
      }

      return scrollY > NAVBAR_CONDENSE_SCROLL_Y;
    };
    const handleScroll = () => {
      if (scrollFrame !== null) {
        return;
      }

      scrollFrame = window.requestAnimationFrame(() => {
        applyCondensedState(resolveCondensedFromScroll());
        scrollFrame = null;
      });
    };

    applyCondensedState(window.scrollY > NAVBAR_CONDENSE_SCROLL_Y);
    window.addEventListener('scroll', handleScroll, { passive: true });

    return () => {
      window.removeEventListener('scroll', handleScroll);
      if (scrollFrame !== null) {
        window.cancelAnimationFrame(scrollFrame);
      }
    };
  }, []);

  return (
    <>
      <div className='es-navbar-offset' aria-hidden='true' />
      <header
        data-figma-node='navbar'
        ref={headerRef}
        className='fixed top-0 left-0 z-40 es-navbar-surface w-full'
      >
        <SectionContainer
          as='nav'
          className='es-navbar-nav flex items-center justify-between gap-2 py-0 pl-0 pr-4 sm:gap-3 sm:pr-6 lg:gap-3 lg:pr-8'
        >
          <Link href={localizedHomeHref} prefetch={false} scroll className='shrink-0'>
            <Image
              src={logoSrc}
              alt={content.brand}
              width={150}
              height={150}
              className='es-navbar-logo'
            />
          </Link>

          <DesktopMenuItems
            items={content.menuItems}
            currentPath={currentPath}
            locale={currentLocale}
            submenuToggleLabelTemplate={content.submenuToggleLabelTemplate}
          />

          <div className='hidden items-center lg:flex'>
            <LanguageSelectorButton
              key={`desktop-language-${pathname}`}
              currentLocale={currentLocale}
              currentPathname={pathname}
              languageSelector={languageSelector}
              className='h-[30px] self-center gap-[9px] px-[6px]'
            />
            <BookNowButton
              href={localizedBookNowHref}
              label={content.bookNow.label}
            />
          </div>

          <div
            data-css-fallback='hide-when-css-missing'
            className='ml-auto flex items-center gap-2 lg:hidden'
          >
            <BookNowButton
              href={localizedBookNowHref}
              label={content.bookNow.label}
              className={NAV_MOBILE_TOPBAR_BOOK_BUTTON_CLASSNAME}
            />
            <ButtonPrimitive
              variant='icon'
              buttonRef={mobileMenuButtonRef}
              aria-controls='mobile-navigation-drawer'
              aria-expanded={isMobileMenuOpen}
              aria-haspopup='dialog'
              aria-label={openNavigationMenuAriaLabel}
              onClick={openMobileMenu}
              className={NAV_OPEN_MENU_BUTTON_CLASSNAME}
            >
              <span className='sr-only'>{openNavigationMenuAriaLabel}</span>
              <span aria-hidden='true' className={NAV_HAMBURGER_ICON_CLASSNAME} />
            </ButtonPrimitive>
          </div>
        </SectionContainer>
      </header>
      {isMobileMenuRendered && (
        <div className='fixed inset-0 z-[60] lg:hidden'>
          <OverlayBackdrop
            tabIndex={-1}
            ariaLabel={closeNavigationMenuAriaLabel}
            className={`absolute inset-0 bg-black/35 transition-opacity duration-300 ${isMobileMenuOpen ? 'opacity-100' : 'opacity-0'}`}
            onClick={closeMobileMenu}
          />
          <OverlayDrawerPanel
            isOpen={isMobileMenuOpen}
            id='mobile-navigation-drawer'
            panelRef={mobileNavigationDrawerRef}
            role='dialog'
            aria-modal='true'
            aria-label={mobileNavigationMenuAriaLabel}
            className={`${MOBILE_PANEL_WIDTH_CLASS} es-navbar-surface`}
          >
            <div className='flex items-center justify-between px-4 py-4'>
              <Link
                href={localizedHomeHref}
                prefetch={false}
                scroll
                className='shrink-0'
                onClick={closeMobileMenu}
              >
                <Image
                  src={logoSrc}
                  alt={content.brand}
                  width={150}
                  height={150}
                  className='es-navbar-logo'
                />
              </Link>
              <ButtonPrimitive
                variant='icon'
                buttonRef={mobileMenuCloseButtonRef}
                aria-label={closeNavigationMenuAriaLabel}
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
                submenuToggleLabelTemplate={content.submenuToggleLabelTemplate}
              />
              <div className='mt-6 pt-4'>
                <LanguageSelectorButton
                  key={`mobile-drawer-language-${pathname}`}
                  currentLocale={currentLocale}
                  currentPathname={pathname}
                  languageSelector={languageSelector}
                  menuAlign='left'
                  className={NAV_MOBILE_DRAWER_LANGUAGE_BUTTON_CLASSNAME}
                />
                <BookNowButton
                  href={localizedBookNowHref}
                  label={content.bookNow.label}
                  onClick={closeMobileMenu}
                  className={NAV_MOBILE_DRAWER_BOOK_BUTTON_CLASSNAME}
                />
              </div>
            </div>
          </OverlayDrawerPanel>
        </div>
      )}
    </>
  );
}
