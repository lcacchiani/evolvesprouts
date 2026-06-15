import { useEffect, useRef } from 'react';

const BOOKING_SYSTEM_QUERY_PARAM = 'booking_system';

interface UseBookingAutoOpenFromQueryOptions {
  bookingSystem: string;
  canOpen: boolean;
  onOpen: () => void;
}

export function useBookingAutoOpenFromQuery({
  bookingSystem,
  canOpen,
  onOpen,
}: UseBookingAutoOpenFromQueryOptions) {
  const hasOpenedBookingModalFromQueryRef = useRef(false);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    const queryParams = new URLSearchParams(window.location.search);
    if (queryParams.get(BOOKING_SYSTEM_QUERY_PARAM) !== bookingSystem) {
      return;
    }
    if (hasOpenedBookingModalFromQueryRef.current) {
      return;
    }
    if (!canOpen) {
      return;
    }

    hasOpenedBookingModalFromQueryRef.current = true;
    const openModalTimerId = window.setTimeout(() => {
      onOpen();
    }, 0);

    return () => {
      window.clearTimeout(openModalTimerId);
    };
  }, [bookingSystem, canOpen, onOpen]);
}
