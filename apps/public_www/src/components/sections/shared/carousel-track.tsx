'use client';

import {
  type HTMLAttributes,
  type MouseEventHandler,
  type PointerEventHandler,
  type ReactNode,
  type RefObject,
  useCallback,
  useRef,
} from 'react';

const CAROUSEL_TRACK_BASE_CLASSES =
  'snap-x snap-mandatory overflow-x-auto cursor-grab active:cursor-grabbing [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden';
const DRAG_CLICK_SUPPRESSION_THRESHOLD_PX = 4;

interface CarouselTrackProps extends HTMLAttributes<HTMLDivElement> {
  carouselRef?: RefObject<HTMLDivElement | null>;
  ariaLabel: string;
  children: ReactNode;
  testId?: string;
}

export function CarouselTrack({
  carouselRef,
  ariaLabel,
  className,
  children,
  testId,
  onPointerDown,
  onPointerMove,
  onPointerUp,
  onPointerLeave,
  onPointerCancel,
  onClickCapture,
  ...rest
}: CarouselTrackProps) {
  const dragStateRef = useRef({
    isDragging: false,
    startClientX: 0,
    startScrollLeft: 0,
  });
  const suppressClickRef = useRef(false);

  const handlePointerDown = useCallback<PointerEventHandler<HTMLDivElement>>(
    (event) => {
      onPointerDown?.(event);
      if (
        event.defaultPrevented ||
        event.pointerType !== 'mouse' ||
        event.button !== 0
      ) {
        return;
      }

      dragStateRef.current = {
        isDragging: true,
        startClientX: event.clientX,
        startScrollLeft: event.currentTarget.scrollLeft,
      };
      suppressClickRef.current = false;
      event.currentTarget.setPointerCapture?.(event.pointerId);
      event.preventDefault();
    },
    [onPointerDown],
  );

  const handlePointerMove = useCallback<PointerEventHandler<HTMLDivElement>>(
    (event) => {
      onPointerMove?.(event);
      if (
        event.defaultPrevented ||
        event.pointerType !== 'mouse' ||
        !dragStateRef.current.isDragging
      ) {
        return;
      }

      const deltaX = event.clientX - dragStateRef.current.startClientX;
      if (Math.abs(deltaX) > DRAG_CLICK_SUPPRESSION_THRESHOLD_PX) {
        suppressClickRef.current = true;
      }
      event.currentTarget.scrollLeft = dragStateRef.current.startScrollLeft - deltaX;
      event.preventDefault();
    },
    [onPointerMove],
  );

  const endDrag = useCallback(
    (target: HTMLDivElement, pointerId: number | null) => {
      if (
        pointerId !== null &&
        target.hasPointerCapture?.(pointerId)
      ) {
        target.releasePointerCapture?.(pointerId);
      }
      dragStateRef.current.isDragging = false;
    },
    [],
  );

  const handlePointerUp = useCallback<PointerEventHandler<HTMLDivElement>>(
    (event) => {
      onPointerUp?.(event);
      if (event.defaultPrevented) {
        return;
      }
      if (event.pointerType !== 'mouse') {
        endDrag(event.currentTarget, null);
        return;
      }

      endDrag(event.currentTarget, event.pointerId);
    },
    [endDrag, onPointerUp],
  );

  const handlePointerLeave = useCallback<PointerEventHandler<HTMLDivElement>>(
    (event) => {
      onPointerLeave?.(event);
      if (event.defaultPrevented) {
        return;
      }
      if (event.pointerType !== 'mouse') {
        endDrag(event.currentTarget, null);
        return;
      }

      endDrag(event.currentTarget, event.pointerId);
    },
    [endDrag, onPointerLeave],
  );

  const handlePointerCancel = useCallback<PointerEventHandler<HTMLDivElement>>(
    (event) => {
      onPointerCancel?.(event);
      if (event.defaultPrevented) {
        return;
      }
      if (event.pointerType !== 'mouse') {
        endDrag(event.currentTarget, null);
        return;
      }

      endDrag(event.currentTarget, event.pointerId);
    },
    [endDrag, onPointerCancel],
  );

  const handleClickCapture = useCallback<MouseEventHandler<HTMLDivElement>>(
    (event) => {
      onClickCapture?.(event);
      if (event.defaultPrevented) {
        return;
      }
      if (!suppressClickRef.current) {
        return;
      }

      suppressClickRef.current = false;
      event.preventDefault();
      event.stopPropagation();
    },
    [onClickCapture],
  );

  return (
    <div
      ref={carouselRef}
      role='region'
      aria-roledescription='carousel'
      aria-label={ariaLabel}
      data-testid={testId}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerLeave={handlePointerLeave}
      onPointerCancel={handlePointerCancel}
      onClickCapture={handleClickCapture}
      className={`${CAROUSEL_TRACK_BASE_CLASSES}${className ? ` ${className}` : ''}`}
      {...rest}
    >
      {children}
    </div>
  );
}
