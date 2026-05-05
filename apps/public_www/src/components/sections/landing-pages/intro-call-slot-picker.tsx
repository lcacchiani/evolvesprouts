'use client';

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
} from 'react';

import { CarouselTrack } from '@/components/sections/shared/carousel-track';
import { EventsLoadingState } from '@/components/sections/shared/events-shared';
import { ButtonPrimitive } from '@/components/shared/button-primitive';
import type {
  CommonAccessibilityContent,
  LandingPageIntroCallContent,
} from '@/content';
import type { IntroCallSlot } from '@/lib/intro-call-slots-api';
import {
  CALENDAR_PUBLIC_CLIENT_FETCH_TIMEOUT_MS,
  fetchIntroCallSlots,
} from '@/lib/intro-call-slots-api';
import { useHorizontalCarousel } from '@/lib/hooks/use-horizontal-carousel';
import { PUBLIC_SITE_IANA_TIMEZONE } from '@/lib/site-datetime';
import { trackAnalyticsEvent } from '@/lib/analytics';
import { resolvePublicSiteConfig } from '@/lib/site-config';

export interface IntroCallSlotPickerProps {
  commonAccessibility: CommonAccessibilityContent;
  pickerContent: LandingPageIntroCallContent;
  /** Same WhatsApp URL as the booking section (falls back to site config when unset). */
  whatsappHref?: string;
  onSelect: (slot: IntroCallSlot) => void;
  onBlockersStatusChange?: (status: 'idle' | 'loading' | 'ready' | 'error') => void;
  refreshToken?: number;
}

type FetchStatus = 'idle' | 'loading' | 'ready' | 'error';

const DAY_STRIP_FORMATTER = new Intl.DateTimeFormat('en-US', {
  timeZone: PUBLIC_SITE_IANA_TIMEZONE,
  weekday: 'short',
});

const DAY_NUM_FORMATTER = new Intl.DateTimeFormat('en-GB', {
  timeZone: PUBLIC_SITE_IANA_TIMEZONE,
  day: '2-digit',
  month: 'short',
});

const SLOT_TIME_FORMATTER = new Intl.DateTimeFormat(undefined, {
  timeZone: PUBLIC_SITE_IANA_TIMEZONE,
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
});

const WALL_HOUR_FORMATTER = new Intl.DateTimeFormat('en-GB', {
  timeZone: PUBLIC_SITE_IANA_TIMEZONE,
  hour: 'numeric',
  hourCycle: 'h23',
});

function DateArrowIcon({ direction }: { direction: 'left' | 'right' }) {
  const rotationClass = direction === 'left' ? 'rotate-180' : '';

  return (
    <span
      aria-hidden
      className={`es-ui-icon-mask es-ui-icon-mask--chevron-right inline-block h-7 w-7 shrink-0 es-text-icon ${rotationClass}`}
    />
  );
}

function ymdForSlot(slot: IntroCallSlot): string {
  const d = new Date(slot.startIso);
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: PUBLIC_SITE_IANA_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(d);
}

function wallClockHourFromIso(iso: string): number {
  const parts = WALL_HOUR_FORMATTER.formatToParts(new Date(iso));
  const hourPart = parts.find((p) => p.type === 'hour');
  return hourPart ? Number.parseInt(hourPart.value, 10) : 0;
}

function isMorningSlot(slot: IntroCallSlot): boolean {
  return wallClockHourFromIso(slot.startIso) < 12;
}

export function IntroCallSlotPicker({
  commonAccessibility,
  pickerContent,
  whatsappHref,
  onSelect,
  onBlockersStatusChange,
  refreshToken = 0,
}: IntroCallSlotPickerProps) {
  const [slots, setSlots] = useState<IntroCallSlot[]>([]);
  const [status, setStatus] = useState<FetchStatus>('idle');
  /** User-picked day; when null or stale, ``resolvedDayYmd`` falls back to the first available day. */
  const [cursorDayYmd, setCursorDayYmd] = useState<string | null>(null);
  const [selectedSlotIso, setSelectedSlotIso] = useState<string | null>(null);
  const [rovingDayIndex, setRovingDayIndex] = useState(0);
  const dayRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const slotRefs = useRef<Array<HTMLButtonElement | null>>([]);

  const setStatusBoth = useCallback(
    (next: FetchStatus) => {
      setStatus(next);
      onBlockersStatusChange?.(next);
    },
    [onBlockersStatusChange],
  );

  useEffect(() => {
    trackAnalyticsEvent('intro_call_slot_picker_status_change', {
      sectionId: 'intro-call-booking',
      ctaLocation: 'intro_call_slot_picker',
      params: { status },
    });
  }, [status]);

  useEffect(() => {
    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => {
      controller.abort();
    }, CALENDAR_PUBLIC_CLIENT_FETCH_TIMEOUT_MS);

    const loadingFrame = window.requestAnimationFrame(() => {
      setStatusBoth('loading');
    });

    fetchIntroCallSlots(controller.signal)
      .then((res) => {
        if (res.fetchFailed) {
          setStatusBoth('error');
          setSlots([]);
          return;
        }
        const sorted = [...res.slots].sort((a, b) => a.startIso.localeCompare(b.startIso));
        setSlots(sorted);
        setStatusBoth('ready');
      })
      .catch(() => {
        setStatusBoth('error');
        setSlots([]);
      })
      .finally(() => {
        window.clearTimeout(timeoutId);
      });

    return () => {
      window.cancelAnimationFrame(loadingFrame);
      window.clearTimeout(timeoutId);
      controller.abort();
    };
  }, [refreshToken, setStatusBoth]);

  const slotsByDay = useMemo(() => {
    const map = new Map<string, IntroCallSlot[]>();
    for (const s of slots) {
      const ymd = ymdForSlot(s);
      const arr = map.get(ymd) ?? [];
      arr.push(s);
      map.set(ymd, arr);
    }
    for (const arr of map.values()) {
      arr.sort((a, b) => a.startIso.localeCompare(b.startIso));
    }
    return map;
  }, [slots]);

  const dayKeys = useMemo(
    () => Array.from(slotsByDay.keys()).sort(),
    [slotsByDay],
  );

  const {
    carouselRef: dayCarouselRef,
    hasNavigation: hasDayNavigation,
    canScrollPrevious: canScrollDayLeft,
    canScrollNext: canScrollDayRight,
    scrollByDirection: scrollDayCarouselByDirection,
    scrollItemIntoView,
  } = useHorizontalCarousel<HTMLDivElement>({
    itemCount: dayKeys.length,
    minItemsForNavigation: 3,
    loop: false,
  });

  const resolvedDayYmd = useMemo(() => {
    if (dayKeys.length === 0) {
      return null;
    }
    if (cursorDayYmd && dayKeys.includes(cursorDayYmd)) {
      return cursorDayYmd;
    }
    return dayKeys[0] ?? null;
  }, [cursorDayYmd, dayKeys]);

  const safeRovingDayIndex = useMemo(
    () => Math.min(rovingDayIndex, Math.max(0, dayKeys.length - 1)),
    [dayKeys.length, rovingDayIndex],
  );

  useEffect(() => {
    const el = dayRefs.current[safeRovingDayIndex];
    scrollItemIntoView(el);
  }, [resolvedDayYmd, safeRovingDayIndex, scrollItemIntoView]);

  const daySlots = useMemo(
    () => (resolvedDayYmd ? slotsByDay.get(resolvedDayYmd) ?? [] : []),
    [resolvedDayYmd, slotsByDay],
  );
  const morningSlots = useMemo(
    () => daySlots.filter((s) => isMorningSlot(s)),
    [daySlots],
  );
  const afternoonSlots = useMemo(
    () => daySlots.filter((s) => !isMorningSlot(s)),
    [daySlots],
  );

  const whatsappUrl =
    whatsappHref?.trim()
    || resolvePublicSiteConfig().whatsappUrl?.trim()
    || '';

  const summaryText = useMemo(() => {
    if (!selectedSlotIso) {
      return '';
    }
    const slot = slots.find((s) => s.startIso === selectedSlotIso);
    if (!slot) {
      return '';
    }
    const start = new Date(slot.startIso);
    const label = new Intl.DateTimeFormat(undefined, {
      timeZone: PUBLIC_SITE_IANA_TIMEZONE,
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).format(start);
    return label;
  }, [selectedSlotIso, slots]);

  const handleDayKeyDown = (event: KeyboardEvent, index: number) => {
    if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
      event.preventDefault();
      const next = Math.min(index + 1, dayKeys.length - 1);
      setRovingDayIndex(next);
      setCursorDayYmd(dayKeys[next] ?? null);
      dayRefs.current[next]?.focus();
    } else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
      event.preventDefault();
      const next = Math.max(index - 1, 0);
      setRovingDayIndex(next);
      setCursorDayYmd(dayKeys[next] ?? null);
      dayRefs.current[next]?.focus();
    }
  };

  if (status === 'loading' || status === 'idle') {
    return (
      <EventsLoadingState
        label={pickerContent.loadingLabel}
        testId='intro-call-slots-loading'
      />
    );
  }

  if (status === 'error') {
    const message =
      pickerContent.loadErrorMessage ?? pickerContent.emptySlotsMessage;
    return (
      <div className='space-y-3' role='alert'>
        <p className='es-type-body'>{message}</p>
        <a
          href={whatsappUrl}
          className='es-focus-ring es-inline-cta-link text-sm font-semibold'
          rel='noopener noreferrer'
        >
          {pickerContent.whatsappHelpCtaLabel}
        </a>
      </div>
    );
  }

  if (slots.length === 0) {
    return (
      <div className='space-y-3'>
        <p className='es-type-body'>{pickerContent.emptySlotsMessage}</p>
        <a
          href={whatsappUrl}
          className='es-focus-ring es-inline-cta-link text-sm font-semibold'
          rel='noopener noreferrer'
        >
          {pickerContent.whatsappHelpCtaLabel}
        </a>
      </div>
    );
  }

  function renderSlotGrid(slotsChunk: IntroCallSlot[], offsetIndex: number, partLabel: string) {
    return (
      <div
        className='grid grid-cols-2 gap-2 sm:grid-cols-3'
        role='group'
        aria-label={`${partLabel}: ${pickerContent.bookingSectionTitle}`}
      >
        {slotsChunk.map((slot, sidx) => {
          const start = new Date(slot.startIso);
          const label = SLOT_TIME_FORMATTER.format(start);
          const pressed = selectedSlotIso === slot.startIso;
          const globalIdx = offsetIndex + sidx;
          return (
            <ButtonPrimitive
              key={slot.startIso}
              type='button'
              buttonRef={(el) => {
                slotRefs.current[globalIdx] = el;
              }}
              variant='selection'
              state={pressed ? 'active' : 'inactive'}
              aria-pressed={pressed}
              className='rounded-md px-2 py-2 text-sm'
              onClick={() => {
                setSelectedSlotIso(slot.startIso);
                onSelect(slot);
                trackAnalyticsEvent('intro_call_slot_selected', {
                  sectionId: 'intro-call-booking',
                  ctaLocation: 'intro_call_slot_picker',
                  params: { slot_start: slot.startIso },
                });
              }}
            >
              {label}
            </ButtonPrimitive>
          );
        })}
      </div>
    );
  }

  return (
    <div className='space-y-4'>
      <div className='relative w-full min-w-0 overflow-visible'>
        <CarouselTrack
          carouselRef={dayCarouselRef}
          testId='intro-call-day-carousel'
          ariaLabel={pickerContent.bookingSectionTitle}
          ariaRoleDescription={commonAccessibility.carouselRoleDescription}
          className='flex min-w-0 gap-2 pb-2'
        >
          {dayKeys.map((ymd, idx) => {
            const count = slotsByDay.get(ymd)?.length ?? 0;
            if (count === 0) {
              return null;
            }
            const sample = slotsByDay.get(ymd)?.[0];
            if (!sample) {
              return null;
            }
            const d = new Date(sample.startIso);
            const wd = DAY_STRIP_FORMATTER.format(d);
            const dm = DAY_NUM_FORMATTER.format(d);
            const isSelected = ymd === resolvedDayYmd;
            return (
              <ButtonPrimitive
                key={ymd}
                type='button'
                buttonRef={(el) => {
                  dayRefs.current[idx] = el;
                }}
                variant='selection'
                state={isSelected ? 'active' : 'inactive'}
                aria-pressed={isSelected}
                tabIndex={safeRovingDayIndex === idx ? 0 : -1}
                onClick={() => {
                  setCursorDayYmd(ymd);
                  setRovingDayIndex(idx);
                  setSelectedSlotIso(null);
                }}
                onKeyDown={(e) => handleDayKeyDown(e, idx)}
                className='w-[140px] shrink-0 snap-center text-left text-sm sm:w-[168px]'
              >
                <div className='font-semibold'>{wd}</div>
                <div className='text-slate-600'>{dm}</div>
              </ButtonPrimitive>
            );
          })}
        </CarouselTrack>

        {hasDayNavigation && canScrollDayLeft ? (
          <ButtonPrimitive
            variant='control'
            type='button'
            onClick={() => {
              scrollDayCarouselByDirection('prev');
            }}
            aria-label={pickerContent.scrollDatesLeftAriaLabel}
            className='absolute left-0 top-1/2 z-20 hidden -translate-x-1/2 -translate-y-1/2 md:flex'
          >
            <DateArrowIcon direction='left' />
          </ButtonPrimitive>
        ) : null}

        {hasDayNavigation && canScrollDayRight ? (
          <ButtonPrimitive
            variant='control'
            type='button'
            onClick={() => {
              scrollDayCarouselByDirection('next');
            }}
            aria-label={pickerContent.scrollDatesRightAriaLabel}
            className='absolute right-0 top-1/2 z-20 hidden translate-x-1/2 -translate-y-1/2 md:flex'
          >
            <DateArrowIcon direction='right' />
          </ButtonPrimitive>
        ) : null}
      </div>

      {resolvedDayYmd && daySlots.length > 0 ? (
        <div className='space-y-4'>
          {morningSlots.length > 0 ? (
            <div className='space-y-2'>
              <p className='text-sm font-semibold es-text-heading'>
                {pickerContent.morningSectionLabel}
              </p>
              {renderSlotGrid(morningSlots, 0, pickerContent.morningSectionLabel)}
            </div>
          ) : null}
          {afternoonSlots.length > 0 ? (
            <div className='space-y-2'>
              <p className='text-sm font-semibold es-text-heading'>
                {pickerContent.afternoonSectionLabel}
              </p>
              {renderSlotGrid(
                afternoonSlots,
                morningSlots.length,
                pickerContent.afternoonSectionLabel,
              )}
            </div>
          ) : null}
        </div>
      ) : null}

      <p className='sr-only' aria-live='polite'>
        {summaryText}
      </p>
    </div>
  );
}
