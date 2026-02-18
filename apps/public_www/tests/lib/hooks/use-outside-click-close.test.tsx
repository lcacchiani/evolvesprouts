import { fireEvent, render, screen } from '@testing-library/react';
import { useRef } from 'react';
import { describe, expect, it, vi } from 'vitest';

import { useOutsideClickClose } from '@/lib/hooks/use-outside-click-close';

function HookHarness({
  isActive = true,
  onOutsideClick,
}: {
  isActive?: boolean;
  onOutsideClick: () => void;
}) {
  const targetRef = useRef<HTMLDivElement | null>(null);
  useOutsideClickClose({
    ref: targetRef,
    onOutsideClick,
    isActive,
  });

  return (
    <div>
      <div ref={targetRef} data-testid='inside'>
        inside
      </div>
      <button type='button' data-testid='outside'>
        outside
      </button>
    </div>
  );
}

describe('useOutsideClickClose', () => {
  it('ignores interactions inside the target element', () => {
    const onOutsideClick = vi.fn();
    render(<HookHarness onOutsideClick={onOutsideClick} />);

    fireEvent.mouseDown(screen.getByTestId('inside'));
    expect(onOutsideClick).not.toHaveBeenCalled();
  });

  it('calls the callback when clicking outside the target element', () => {
    const onOutsideClick = vi.fn();
    render(<HookHarness onOutsideClick={onOutsideClick} />);

    fireEvent.mouseDown(screen.getByTestId('outside'));
    expect(onOutsideClick).toHaveBeenCalledTimes(1);
  });

  it('does not attach listeners when inactive', () => {
    const onOutsideClick = vi.fn();
    render(<HookHarness isActive={false} onOutsideClick={onOutsideClick} />);

    fireEvent.mouseDown(screen.getByTestId('outside'));
    expect(onOutsideClick).not.toHaveBeenCalled();
  });
});
