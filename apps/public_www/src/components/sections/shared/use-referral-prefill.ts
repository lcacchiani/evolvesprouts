import { useEffect, useRef } from 'react';

import { readReferralCodeFromSearch } from '@/lib/referral-link';

export function useReferralPrefill(onPrefill: (code: string) => void) {
  const hasHandledReferralPrefillRef = useRef(false);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    if (hasHandledReferralPrefillRef.current) {
      return;
    }

    hasHandledReferralPrefillRef.current = true;
    const referral = readReferralCodeFromSearch(window.location.search);
    if (referral) {
      queueMicrotask(() => {
        onPrefill(referral);
      });
    }
  }, [onPrefill]);
}
