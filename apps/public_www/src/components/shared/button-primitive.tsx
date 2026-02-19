import type {
  AnchorHTMLAttributes,
  ButtonHTMLAttributes,
  Ref,
  ReactNode,
} from 'react';

import { SmartLink } from '@/components/shared/smart-link';
import { mergeClassNames } from '@/lib/class-name-utils';
import type { HrefKind } from '@/lib/url-utils';

export type ButtonPrimitiveVariant =
  | 'primary'
  | 'outline'
  | 'control'
  | 'pill'
  | 'submenu'
  | 'icon'
  | 'selection';

export type ButtonPrimitiveState = 'default' | 'active' | 'inactive';

interface ButtonPrimitiveRenderState {
  isLink: boolean;
  hrefKind: HrefKind;
  isExternal: boolean;
  isExternalHttp: boolean;
  opensInNewTab: boolean;
}

type ButtonPrimitiveChildren =
  | ReactNode
  | ((state: ButtonPrimitiveRenderState) => ReactNode);

interface ButtonPrimitiveBaseProps {
  variant: ButtonPrimitiveVariant;
  state?: ButtonPrimitiveState;
  className?: string;
  children?: ButtonPrimitiveChildren;
}

type ButtonPrimitiveAnchorProps =
  & ButtonPrimitiveBaseProps
  & Omit<
    AnchorHTMLAttributes<HTMLAnchorElement>,
    'children' | 'className' | 'href' | 'style' | 'target' | 'rel'
  >
  & {
    href: string;
    openInNewTab?: boolean;
  };

type ButtonPrimitiveButtonProps =
  & ButtonPrimitiveBaseProps
  & Omit<
    ButtonHTMLAttributes<HTMLButtonElement>,
    'children' | 'className' | 'style'
  >
  & {
    href?: undefined;
    openInNewTab?: never;
    buttonRef?: Ref<HTMLButtonElement>;
  };

export type ButtonPrimitiveProps =
  | ButtonPrimitiveAnchorProps
  | ButtonPrimitiveButtonProps;

function renderChildren(
  children: ButtonPrimitiveChildren | undefined,
  state: ButtonPrimitiveRenderState,
): ReactNode {
  if (typeof children === 'undefined') {
    return null;
  }

  if (typeof children === 'function') {
    return children(state);
  }

  return children;
}

function getBaseState(isLink: boolean): ButtonPrimitiveRenderState {
  return {
    isLink,
    hrefKind: 'internal',
    isExternal: false,
    isExternalHttp: false,
    opensInNewTab: false,
  };
}

export function ButtonPrimitive({
  variant,
  state = 'default',
  className,
  children,
  ...props
}: ButtonPrimitiveProps) {
  const primitiveClassName = mergeClassNames(
    'es-btn',
    `es-btn--${variant}`,
    state === 'default' ? undefined : `es-btn--state-${state}`,
    className,
  );

  if ('href' in props && typeof props.href === 'string') {
    const {
      href,
      openInNewTab,
      ...anchorProps
    } = props;

    return (
      <SmartLink
        href={href}
        openInNewTab={openInNewTab}
        className={primitiveClassName}
        {...anchorProps}
      >
        {(linkState) =>
          renderChildren(children, {
            isLink: true,
            ...linkState,
          })}
      </SmartLink>
    );
  }

  const {
    buttonRef,
    type = 'button',
    ...buttonProps
  } = props;

  return (
    <button
      ref={buttonRef}
      type={type}
      className={primitiveClassName}
      {...buttonProps}
    >
      {renderChildren(children, getBaseState(false))}
    </button>
  );
}
