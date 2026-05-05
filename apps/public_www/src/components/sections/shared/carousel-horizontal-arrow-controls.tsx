'use client';

import type { ReactNode } from 'react';

import { CarouselArrowIcon } from '@/components/sections/shared/carousel-arrow-icon';
import { ButtonPrimitive } from '@/components/shared/button-primitive';
import { mergeClassNames } from '@/lib/class-name-utils';

const WRAPPER_BASE =
  'relative w-full min-w-0 overflow-visible';

const PREV_BUTTON_CLASS =
  'absolute left-0 top-1/2 z-20 hidden -translate-x-1/2 -translate-y-1/2 md:flex';

const NEXT_BUTTON_CLASS =
  'absolute right-0 top-1/2 z-20 hidden translate-x-1/2 -translate-y-1/2 md:flex';

export function CarouselHorizontalArrowControls({
  children,
  showPrevious,
  showNext,
  onPrevious,
  onNext,
  previousAriaLabel,
  nextAriaLabel,
  wrapperClassName,
}: {
  children: ReactNode;
  showPrevious: boolean;
  showNext: boolean;
  onPrevious: () => void;
  onNext: () => void;
  previousAriaLabel: string;
  nextAriaLabel: string;
  /** Extra classes on the relative wrapper (e.g. `mt-3`). */
  wrapperClassName?: string;
}) {
  const wrapClass = mergeClassNames(WRAPPER_BASE, wrapperClassName);

  return (
    <div className={wrapClass}>
      {children}
      {showPrevious ? (
        <ButtonPrimitive
          variant='control'
          type='button'
          onClick={onPrevious}
          aria-label={previousAriaLabel}
          className={PREV_BUTTON_CLASS}
        >
          <CarouselArrowIcon direction='left' />
        </ButtonPrimitive>
      ) : null}
      {showNext ? (
        <ButtonPrimitive
          variant='control'
          type='button'
          onClick={onNext}
          aria-label={nextAriaLabel}
          className={NEXT_BUTTON_CLASS}
        >
          <CarouselArrowIcon direction='right' />
        </ButtonPrimitive>
      ) : null}
    </div>
  );
}
