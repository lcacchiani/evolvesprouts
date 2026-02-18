import type {
  AnchorHTMLAttributes,
  CSSProperties,
  ReactNode,
} from 'react';
import Link from 'next/link';

import { getHrefKind, type HrefKind } from '@/lib/url-utils';

interface SmartLinkRenderState {
  hrefKind: HrefKind;
  isExternal: boolean;
  isExternalHttp: boolean;
  opensInNewTab: boolean;
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
  style?: CSSProperties;
  openInNewTab?: boolean;
  children: SmartLinkChildren;
}

function resolveOpensInNewTab(
  hrefKind: HrefKind,
  openInNewTab: boolean | undefined,
): boolean {
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
  style,
  openInNewTab,
  children,
  ...anchorProps
}: SmartLinkProps) {
  const hrefKind = getHrefKind(href);
  const isExternalHttp = hrefKind === 'http';
  const isExternal =
    hrefKind === 'http' || hrefKind === 'mailto' || hrefKind === 'tel';
  const opensInNewTab = resolveOpensInNewTab(hrefKind, openInNewTab);

  const state: SmartLinkRenderState = {
    hrefKind,
    isExternal,
    isExternalHttp,
    opensInNewTab,
  };

  const linkChildren = renderChildren(children, state);
  const sharedProps = {
    className,
    style,
    ...anchorProps,
    ...(opensInNewTab
      ? { target: '_blank' as const, rel: 'noopener noreferrer' }
      : {}),
  };

  if (hrefKind === 'internal') {
    return (
      <Link href={href} {...sharedProps}>
        {linkChildren}
      </Link>
    );
  }

  return (
    <a href={href} {...sharedProps}>
      {linkChildren}
    </a>
  );
}
