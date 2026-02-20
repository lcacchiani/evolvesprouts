import type {
  ComponentPropsWithoutRef,
  ReactNode,
  Ref,
} from 'react';

import { ButtonPrimitive } from '@/components/shared/button-primitive';
import { mergeClassNames } from '@/lib/class-name-utils';

const DEFAULT_DIALOG_PANEL_CLASSNAME =
  'relative w-full max-w-[1190px] overflow-hidden rounded-3xl border border-black/10 shadow-[0_22px_70px_rgba(0,0,0,0.42)]';
const DEFAULT_DRAWER_PANEL_CLASSNAME =
  'absolute inset-y-0 right-0 flex flex-col shadow-2xl transition-transform duration-300 ease-out';
const DEFAULT_SCROLLABLE_BODY_CLASSNAME =
  'relative max-h-[82vh] overflow-y-auto px-4 pb-6 sm:px-8 sm:pb-8';

interface OverlayBackdropProps
  extends Omit<
    ComponentPropsWithoutRef<'button'>,
    'children' | 'type' | 'aria-label' | 'style'
  > {
  ariaLabel: string;
  className?: string;
}

export function OverlayBackdrop({
  ariaLabel,
  className,
  ...props
}: OverlayBackdropProps) {
  return (
    <ButtonPrimitive
      variant='icon'
      aria-label={ariaLabel}
      className={mergeClassNames('absolute inset-0 border-0', className)}
      {...props}
    />
  );
}

interface OverlayDialogPanelProps
  extends Omit<
    ComponentPropsWithoutRef<'section'>,
    | 'children'
    | 'className'
    | 'ref'
    | 'role'
    | 'aria-modal'
    | 'aria-label'
    | 'aria-labelledby'
    | 'aria-describedby'
  > {
  ariaLabel?: string;
  ariaLabelledBy?: string;
  ariaDescribedBy?: string;
  className?: string;
  panelRef?: Ref<HTMLElement>;
  children: ReactNode;
}

export function OverlayDialogPanel({
  ariaLabel,
  ariaLabelledBy,
  ariaDescribedBy,
  className,
  panelRef,
  children,
  ...props
}: OverlayDialogPanelProps) {
  return (
    <section
      ref={panelRef}
      role='dialog'
      aria-modal='true'
      aria-label={ariaLabelledBy ? undefined : ariaLabel}
      aria-labelledby={ariaLabelledBy}
      aria-describedby={ariaDescribedBy}
      className={mergeClassNames(DEFAULT_DIALOG_PANEL_CLASSNAME, className)}
      {...props}
    >
      {children}
    </section>
  );
}

interface OverlayDrawerPanelProps
  extends Omit<
    ComponentPropsWithoutRef<'aside'>,
    'children' | 'className' | 'ref'
  > {
  isOpen: boolean;
  className?: string;
  panelRef?: Ref<HTMLElement>;
  children: ReactNode;
}

export function OverlayDrawerPanel({
  isOpen,
  className,
  panelRef,
  children,
  ...props
}: OverlayDrawerPanelProps) {
  return (
    <aside
      ref={panelRef}
      className={mergeClassNames(
        DEFAULT_DRAWER_PANEL_CLASSNAME,
        className,
        isOpen ? 'translate-x-0' : 'translate-x-full',
      )}
      {...props}
    >
      {children}
    </aside>
  );
}

interface OverlayScrollableBodyProps
  extends Omit<ComponentPropsWithoutRef<'div'>, 'children' | 'className'> {
  className?: string;
  children: ReactNode;
}

export function OverlayScrollableBody({
  className,
  children,
  ...props
}: OverlayScrollableBodyProps) {
  return (
    <div className={mergeClassNames(DEFAULT_SCROLLABLE_BODY_CLASSNAME, className)} {...props}>
      {children}
    </div>
  );
}
