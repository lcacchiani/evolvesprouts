import {
  createRef,
  type ComponentPropsWithoutRef,
  type ReactNode,
  type Ref,
} from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import {
  OverlayBackdrop,
  OverlayDialogPanel,
  OverlayDrawerPanel,
  OverlayScrollableBody,
} from '@/components/shared/overlay-surface';

vi.mock('@/components/shared/button-primitive', () => ({
  ButtonPrimitive: ({
    children,
    buttonRef,
    variant: _variant,
    ...props
  }: {
    children?: ReactNode;
    buttonRef?: Ref<HTMLButtonElement>;
    variant?: string;
  } & ComponentPropsWithoutRef<'button'>) => (
    <button ref={buttonRef} {...props}>
      {children}
    </button>
  ),
}));

describe('overlay-surface primitives', () => {
  it('renders a clickable backdrop button with merged classes', () => {
    render(
      <OverlayBackdrop
        ariaLabel='Close overlay'
        className='custom-backdrop'
        onClick={() => {}}
      />,
    );

    const backdrop = screen.getByRole('button', { name: 'Close overlay' });
    expect(backdrop.className).toContain('absolute inset-0 border-0');
    expect(backdrop.className).toContain('custom-backdrop');
  });

  it('renders dialog semantics using label or labelledby attributes', () => {
    const { rerender } = render(
      <OverlayDialogPanel ariaLabel='Dialog title'>Dialog content</OverlayDialogPanel>,
    );

    const labelledDialog = screen.getByRole('dialog', { name: 'Dialog title' });
    expect(labelledDialog).toHaveAttribute('aria-modal', 'true');
    expect(labelledDialog).toHaveAttribute('aria-label', 'Dialog title');

    rerender(
      <OverlayDialogPanel
        ariaLabelledBy='dialog-heading'
        ariaDescribedBy='dialog-description'
      >
        <h2 id='dialog-heading'>Heading</h2>
        <p id='dialog-description'>Description</p>
      </OverlayDialogPanel>,
    );

    const describedDialog = screen.getByRole('dialog', { name: 'Heading' });
    expect(describedDialog).not.toHaveAttribute('aria-label');
    expect(describedDialog).toHaveAttribute('aria-labelledby', 'dialog-heading');
    expect(describedDialog).toHaveAttribute('aria-describedby', 'dialog-description');
  });

  it('toggles drawer visibility classes and forwards panel refs', () => {
    const panelRef = createRef<HTMLElement>();
    const { rerender } = render(
      <OverlayDrawerPanel isOpen className='drawer-class' panelRef={panelRef}>
        Drawer content
      </OverlayDrawerPanel>,
    );

    const openDrawer = screen.getByText('Drawer content').closest('aside');
    expect(openDrawer).not.toBeNull();
    expect(openDrawer?.className).toContain('translate-x-0');
    expect(openDrawer?.className).toContain('drawer-class');
    expect(panelRef.current).toBe(openDrawer);

    rerender(
      <OverlayDrawerPanel isOpen={false} className='drawer-class'>
        Drawer content
      </OverlayDrawerPanel>,
    );

    const closedDrawer = screen.getByText('Drawer content').closest('aside');
    expect(closedDrawer?.className).toContain('translate-x-full');
  });

  it('renders scrollable body with default and custom classes', () => {
    render(
      <OverlayScrollableBody className='custom-scrollable'>
        Scrollable body
      </OverlayScrollableBody>,
    );

    const container = screen.getByText('Scrollable body').closest('div');
    expect(container).not.toBeNull();
    expect(container?.className).toContain('max-h-[82vh]');
    expect(container?.className).toContain('custom-scrollable');
  });
});
