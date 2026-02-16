import { render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { useModalLockBody } from '@/lib/hooks/use-modal-lock-body';

function HookHarness({
  isActive = true,
  onEscape,
}: {
  isActive?: boolean;
  onEscape: () => void;
}) {
  useModalLockBody({ isActive, onEscape });
  return null;
}

describe('useModalLockBody', () => {
  it('locks body scroll while active and restores it on cleanup', () => {
    document.body.style.overflow = 'auto';
    const onEscape = vi.fn();
    const view = render(<HookHarness onEscape={onEscape} />);

    expect(document.body.style.overflow).toBe('hidden');

    view.unmount();
    expect(document.body.style.overflow).toBe('auto');
  });

  it('calls the callback when Escape is pressed', () => {
    const onEscape = vi.fn();
    render(<HookHarness onEscape={onEscape} />);

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(onEscape).toHaveBeenCalledTimes(1);
  });

  it('does nothing when the hook is inactive', () => {
    document.body.style.overflow = 'visible';
    const onEscape = vi.fn();
    render(<HookHarness isActive={false} onEscape={onEscape} />);

    expect(document.body.style.overflow).toBe('visible');
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(onEscape).not.toHaveBeenCalled();
  });

  it('keeps body locked until all active locks are released', () => {
    document.body.style.overflow = 'visible';
    const onEscape = vi.fn();

    const first = render(<HookHarness onEscape={onEscape} />);
    const second = render(<HookHarness onEscape={onEscape} />);

    expect(document.body.style.overflow).toBe('hidden');

    first.unmount();
    expect(document.body.style.overflow).toBe('hidden');

    second.unmount();
    expect(document.body.style.overflow).toBe('visible');
  });
});
