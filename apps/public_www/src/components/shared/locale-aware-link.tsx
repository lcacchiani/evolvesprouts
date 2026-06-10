'use client';

import type {
  AnchorHTMLAttributes,
  ReactNode,
} from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

import {
  getLocaleFromPath,
  localizeHref,
} from '@/lib/locale-routing';

interface LocaleAwareLinkProps
  extends Omit<
    AnchorHTMLAttributes<HTMLAnchorElement>,
    'children' | 'href' | 'style'
  > {
  href: string;
  scroll?: boolean;
  children: ReactNode;
}

/**
 * Internal-link renderer that keeps the visitor's locale.
 *
 * Internal hrefs from locale content are locale-agnostic (for example
 * `/services/consultations`); root paths redirect to the default locale, so
 * zh-CN/zh-HK visitors would otherwise lose their locale on navigation.
 */
export function LocaleAwareLink({
  href,
  scroll,
  children,
  ...anchorProps
}: LocaleAwareLinkProps) {
  const pathname = usePathname() ?? '/';
  const locale = getLocaleFromPath(pathname);

  return (
    <Link
      href={localizeHref(href, locale)}
      prefetch={false}
      scroll={scroll}
      {...anchorProps}
    >
      {children}
    </Link>
  );
}
