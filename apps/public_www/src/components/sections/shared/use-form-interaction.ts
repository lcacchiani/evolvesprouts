import { useCallback, useState } from 'react';

interface UseFormInteractionGateOptions {
  initiallyInteracted?: boolean;
}

interface FormInteractionGate {
  hasFormInteracted: boolean;
  markFormInteracted: () => void;
  // Spread onto the <form> element. Captures the bubbled focus from any
  // descendant (input, select, textarea, checkbox, etc.) on the first
  // interaction and ignores subsequent focus changes.
  formInteractionProps: { onFocus: () => void };
}

export function useFormInteractionGate(
  options?: UseFormInteractionGateOptions,
): FormInteractionGate {
  const [hasFormInteracted, setHasFormInteracted] = useState(
    options?.initiallyInteracted ?? false,
  );
  const markFormInteracted = useCallback(() => {
    setHasFormInteracted((current) => (current ? current : true));
  }, []);
  return {
    hasFormInteracted,
    markFormInteracted,
    formInteractionProps: { onFocus: markFormInteracted },
  };
}
