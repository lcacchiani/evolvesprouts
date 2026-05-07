import { act, renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { useFormInteractionGate } from '@/components/sections/shared/use-form-interaction';

describe('useFormInteractionGate', () => {
  it('defaults hasFormInteracted to false', () => {
    const { result } = renderHook(() => useFormInteractionGate());
    expect(result.current.hasFormInteracted).toBe(false);
  });

  it('starts true when initiallyInteracted is true', () => {
    const { result } = renderHook(() =>
      useFormInteractionGate({ initiallyInteracted: true }),
    );
    expect(result.current.hasFormInteracted).toBe(true);
  });

  it('sets hasFormInteracted true when markFormInteracted is called', () => {
    const { result } = renderHook(() => useFormInteractionGate());
    act(() => {
      result.current.markFormInteracted();
    });
    expect(result.current.hasFormInteracted).toBe(true);
  });

  it('sets hasFormInteracted true when formInteractionProps.onFocus is called', () => {
    const { result } = renderHook(() => useFormInteractionGate());
    act(() => {
      result.current.formInteractionProps.onFocus();
    });
    expect(result.current.hasFormInteracted).toBe(true);
  });

  it('only transitions once when markFormInteracted and onFocus run twice', () => {
    let renderCount = 0;
    const { result } = renderHook(() => {
      renderCount++;
      return useFormInteractionGate();
    });
    const initialRenderCount = renderCount;
    act(() => {
      result.current.markFormInteracted();
      result.current.markFormInteracted();
      result.current.formInteractionProps.onFocus();
    });
    expect(result.current.hasFormInteracted).toBe(true);
    expect(renderCount - initialRenderCount).toBe(1);
  });
});
