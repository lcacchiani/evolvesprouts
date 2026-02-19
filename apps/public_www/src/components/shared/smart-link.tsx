import type {
  AnchorHTMLAttributes,
  ReactNode,
} from 'react';
import Link from 'next/link';

import { getHrefKind, type HrefKind } from '@/lib/url-utils';

interface SmartLinkRenderState {
  hrefKind: HrefKind;
  isExternal: boolean;
  isExternalHttp: boolean;
  opensInNewTab: boolean;
  isUnsafe: boolean;
}

type SmartLinkChildren =
  | ReactNode
  | ((state: SmartLinkRenderState) => ReactNode);

interface SmartLinkProps
  extends Omit<
    AnchorHTMLAttributes<HTMLAnchorElement>,
    'children' | 'className' | 'href' | 'style' | 'rel' | 'target'
  > {
  href: string;
  className?: string;
  openInNewTab?: boolean;
  children: SmartLinkChildren;
}

function resolveOpensInNewTab(
  hrefKind: HrefKind,
  openInNewTab: boolean | undefined,
): boolean {
  if (hrefKind === 'unsafe') {
    return false;
  }

  if (typeof openInNewTab === 'boolean') {
    return openInNewTab;
  }

  return hrefKind === 'http';
}

function renderChildren(
  children: SmartLinkChildren,
  state: SmartLinkRenderState,
): ReactNode {
  if (typeof children === 'function') {
    return children(state);
  }

  return children;
}

export function SmartLink({
  href,
  className,
  openInNewTab,
  children,
  ...anchorProps
}: SmartLinkProps) {
  const hrefKind = getHrefKind(href);
  const isUnsafe = hrefKind === 'unsafe';
  const isExternalHttp = hrefKind === 'http';
  const isExternal =
    hrefKind === 'http' || hrefKind === 'mailto' || hrefKind === 'tel';
  const opensInNewTab = resolveOpensInNewTab(hrefKind, openInNewTab);
  const resolvedHref = isUnsafe ? '#' : href;

  const state: SmartLinkRenderState = {
    hrefKind,
    isExternal,
    isExternalHttp,
    opensInNewTab,
    isUnsafe,
  };

  const linkChildren = renderChildren(children, state);
  const sharedProps = {
    className,
    ...anchorProps,
    ...(opensInNewTab
      ? { target: '_blank' as const, rel: 'noopener noreferrer' }
      : {}),
  };

  if (hrefKind === 'internal') {
    return (
      <Link href={resolvedHref} {...sharedProps}>
        {linkChildren}
      </Link>
    );
  }

  return (
    <a href={resolvedHref} {...sharedProps}>
      {linkChildren}
    </a>
  );
}
