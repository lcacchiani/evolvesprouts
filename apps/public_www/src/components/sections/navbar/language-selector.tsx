'use client';

import Image from 'next/image';
import Link from 'next/link';
import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
} from 'react';

import {
  ButtonPrimitive,
  type ButtonPrimitiveState,
  type ButtonPrimitiveVariant,
} from '@/components/shared/button-primitive';
import {
  isValidLocale,
  type Locale,
  type NavbarContent,
} from '@/content';
import { useOutsideClickClose } from '@/lib/hooks/use-outside-click-close';
import { localizePath } from '@/lib/locale-routing';

const NAV_LANGUAGE_OPTION_CLASSNAME =
  'es-focus-ring es-nav-language-option';
const NAV_LANGUAGE_OPTION_ACTIVE_CLASSNAME = 'es-nav-language-option--active';
const NAV_LANGUAGE_OPTION_INACTIVE_CLASSNAME = 'es-nav-language-option--inactive';
const NAV_LANGUAGE_CHEVRON_ICON_SRC = '/images/chevron.svg';

function buildLanguageOptionClassName(isCurrent: boolean): string {
  const stateClassName = isCurrent
    ? NAV_LANGUAGE_OPTION_ACTIVE_CLASSNAME
    : NAV_LANGUAGE_OPTION_INACTIVE_CLASSNAME;

  return `${NAV_LANGUAGE_OPTION_CLASSNAME} ${stateClassName}`;
}

interface LanguageOption {
  locale: Locale;
  label: string;
  shortLabel: string;
  flagSrc: string;
}

export interface LanguageSelectorContent {
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
    flagSrc: '/images/flags/united-kingdom.svg',
  },
  {
    locale: 'zh-CN',
    label: 'Chinese (Simplified)',
    shortLabel: 'SC',
    flagSrc: '/images/flags/china.svg',
  },
  {
    locale: 'zh-HK',
    label: 'Chinese (Traditional)',
    shortLabel: 'TC',
    flagSrc: '/images/flags/hong-kong.svg',
  },
];

const DEFAULT_LANGUAGE_MENU_ARIA_LABEL = 'Select language';
const DEFAULT_SELECTED_LANGUAGE_ARIA_PREFIX = 'Selected language';

export function resolveLanguageSelectorContent(
  content: NavbarContent,
): LanguageSelectorContent {
  const selector = content.languageSelector as
    | {
        menuAriaLabel?: string;
        selectedLanguageAriaPrefix?: string;
        options?: RawLanguageOption[];
      }
    | undefined;

  const normalizedOptions = (selector?.options ?? [])
    .map((option) => {
      if (!isValidLocale(option.locale)) {
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
      };
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

interface LanguageSelectorButtonProps {
  className: string;
  currentLocale: Locale;
  currentPathname: string;
  languageSelector: LanguageSelectorContent;
  menuAlign?: 'left' | 'right';
  buttonVariant?: ButtonPrimitiveVariant;
  buttonState?: ButtonPrimitiveState;
  isBorderlessMenu?: boolean;
}

export function LanguageSelectorButton({
  className,
  currentLocale,
  currentPathname,
  languageSelector,
  menuAlign = 'right',
  buttonVariant = 'icon',
  buttonState = 'default',
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
      <ButtonPrimitive
        variant={buttonVariant}
        state={buttonState}
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
        <span className='sr-only'>
          {`${languageSelector.selectedLanguageAriaPrefix}: ${activeOption.label}`}
        </span>
        <span
          aria-hidden='true'
          className={`inline-flex h-5 w-5 items-center justify-center transition-transform ${isMenuOpen ? 'rotate-180' : ''}`}
        >
          <Image
            src={NAV_LANGUAGE_CHEVRON_ICON_SRC}
            alt=''
            aria-hidden='true'
            width={20}
            height={20}
            className='h-5 w-5'
          />
        </span>
      </ButtonPrimitive>
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
                className={buildLanguageOptionClassName(isCurrent)}
                onClick={() => {
                  closeMenu();
                }}
                tabIndex={isMenuOpen ? undefined : -1}
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
