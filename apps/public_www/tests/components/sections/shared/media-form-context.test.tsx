import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { type ReactNode } from 'react';

import {
  MediaFormProvider,
  useMediaFormContext,
} from '@/components/sections/shared/media-form-context';

function Consumer() {
  const ctx = useMediaFormContext();
  if (ctx === null) {
    return <span data-testid='ctx-state'>outside</span>;
  }
  return (
    <div>
      <span data-testid='ctx-state'>{ctx.hasSubmitted ? 'true' : 'false'}</span>
      <button type='button' onClick={ctx.markFormSubmitted}>
        mark
      </button>
    </div>
  );
}

function InsideProvider({ children }: { children: ReactNode }) {
  return <MediaFormProvider>{children}</MediaFormProvider>;
}

describe('MediaFormProvider / useMediaFormContext', () => {
  it('returns null from the hook when rendered outside a provider', () => {
    render(<Consumer />);

    expect(screen.getByTestId('ctx-state')).toHaveTextContent('outside');
  });

  it('starts with hasSubmitted false inside the provider', () => {
    render(
      <InsideProvider>
        <Consumer />
      </InsideProvider>,
    );

    expect(screen.getByTestId('ctx-state')).toHaveTextContent('false');
  });

  it('sets hasSubmitted to true when markFormSubmitted is called', () => {
    render(
      <InsideProvider>
        <Consumer />
      </InsideProvider>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'mark' }));

    expect(screen.getByTestId('ctx-state')).toHaveTextContent('true');
  });
});
