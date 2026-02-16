import Link from 'next/link';
import { useCallback, useEffect, useId, useRef, useState } from 'react';

import {
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
  localizeHref,
  normalizeLocalizedPath,
} from '@/lib/locale-routing';

type MenuItem = NavbarContent['menuItems'][number];
type SubmenuItem = NonNullable<MenuItem['children']>[number];

const NAV_PILL_BACKGROUND = 'var(--figma-colors-frame-2147235267, #F6DECD)';
const NAV_TEXT_COLOR = HEADING_TEXT_COLOR;
const NAV_ACTIVE_TEXT = '#C84A16';
const NAV_ACTIVE_BACKGROUND = '#F2A975';
const NAV_TOP_LEVEL_LINK_CLASSNAME =
  'es-focus-ring es-nav-pill justify-center transition-colors';
const NAV_TOP_LEVEL_LINK_WITH_SUBMENU_CLASSNAME =
  `${NAV_TOP_LEVEL_LINK_CLASSNAME} pr-10`;
const NAV_SUBMENU_LINK_CLASSNAME = 'es-focus-ring es-nav-submenu-link';
const NAV_MOBILE_TOP_LEVEL_LINK_CLASSNAME =
  'es-focus-ring es-nav-pill flex-1';
export const MOBILE_PRIMARY_ACTION_CLASSNAME =
  'es-focus-ring es-nav-pill w-full justify-between transition-colors';

const linkStyle = {
  backgroundColor: NAV_PILL_BACKGROUND,
  color: NAV_TEXT_COLOR,
  fontFamily: 'var(--figma-fontfamilies-lato, Lato), sans-serif',
  fontSize: 'var(--figma-fontsizes-18, 18px)',
  fontWeight: 'var(--figma-fontweights-600, 600)',
  lineHeight: 'var(--figma-lineheights-home-2, 100%)',
};

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

function isMenuItemActive(currentPath: string, item: MenuItem): boolean {
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

export function getTopLinkStyle(isActive: boolean) {
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
  const submenuToggleButtonRef = useRef<HTMLButtonElement | null>(null);
  const closeSubmenu = useCallback(
    ({ restoreFocus = true }: { restoreFocus?: boolean } = {}) => {
      if (restoreFocus) {
        const activeElement = document.activeElement;
        if (
          activeElement instanceof HTMLElement &&
          submenuWrapperRef.current?.contains(activeElement) &&
          activeElement !== submenuToggleButtonRef.current
        ) {
          submenuToggleButtonRef.current?.focus();
        }
      }

      setIsSubmenuOpen(false);
    },
    [setIsSubmenuOpen],
  );

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
        ref={submenuToggleButtonRef}
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

export function DesktopMenuItems({
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
          className={MOBILE_PRIMARY_ACTION_CLASSNAME}
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

export function MobileMenuItems({
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
