import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { useRef, useState } from 'react';
import { describe, expect, it } from 'vitest';

import { useModalFocusManagement } from '@/lib/hooks/use-modal-focus-management';

function FocusTrapHarness() {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const initialFocusRef = useRef<HTMLButtonElement | null>(null);

  useModalFocusManagement({
    containerRef,
    initialFocusRef,
  });

  return (
    <div>
      <button type='button'>Outside trigger</button>
      <div ref={containerRef} tabIndex={-1}>
        <button ref={initialFocusRef} type='button'>
          First action
        </button>
        <button type='button'>Last action</button>
      </div>
    </div>
  );
}

function RestoreFocusDialog({ onClose }: { onClose: () => void }) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const initialFocusRef = useRef<HTMLButtonElement | null>(null);

  useModalFocusManagement({
    containerRef,
    initialFocusRef,
  });

  return (
    <div ref={containerRef} tabIndex={-1}>
      <button ref={initialFocusRef} type='button' onClick={onClose}>
        Close modal
      </button>
      <button type='button'>Secondary modal action</button>
    </div>
  );
}

function RestoreFocusHarness() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div>
      <button type='button' onClick={() => setIsOpen(true)}>
        Open modal
      </button>
      {isOpen ? <RestoreFocusDialog onClose={() => setIsOpen(false)} /> : null}
    </div>
  );
}

function NoFocusableHarness() {
  const containerRef = useRef<HTMLDivElement | null>(null);

  useModalFocusManagement({
    containerRef,
  });

  return (
    <div ref={containerRef} tabIndex={-1} data-testid='modal-container'>
      No interactive controls
    </div>
  );
}

describe('useModalFocusManagement', () => {
  it('focuses the initial element and traps focus with Tab navigation', async () => {
    render(<FocusTrapHarness />);

    const firstAction = screen.getByRole('button', { name: 'First action' });
    const lastAction = screen.getByRole('button', { name: 'Last action' });
    await waitFor(() => {
      expect(firstAction).toHaveFocus();
    });

    lastAction.focus();
    fireEvent.keyDown(window, { key: 'Tab' });
    expect(firstAction).toHaveFocus();

    firstAction.focus();
    fireEvent.keyDown(window, { key: 'Tab', shiftKey: true });
    expect(lastAction).toHaveFocus();
  });

  it('restores focus to the opener when the modal unmounts', async () => {
    render(<RestoreFocusHarness />);

    const opener = screen.getByRole('button', { name: 'Open modal' });
    opener.focus();
    fireEvent.click(opener);

    const closeButton = screen.getByRole('button', { name: 'Close modal' });
    await waitFor(() => {
      expect(closeButton).toHaveFocus();
    });

    fireEvent.click(closeButton);
    await waitFor(() => {
      expect(opener).toHaveFocus();
    });
  });

  it('falls back to focusing the container when no controls exist', async () => {
    render(<NoFocusableHarness />);

    const container = screen.getByTestId('modal-container');
    await waitFor(() => {
      expect(container).toHaveFocus();
    });

    fireEvent.keyDown(window, { key: 'Tab' });
    expect(container).toHaveFocus();
  });
});
