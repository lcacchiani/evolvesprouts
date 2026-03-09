'use client';

import {
  type HTMLAttributes,
  type MouseEventHandler,
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
  onMouseDown,
  onMouseMove,
  onMouseUp,
  onMouseLeave,
  onClickCapture,
  ...rest
}: CarouselTrackProps) {
  const dragStateRef = useRef({
    isDragging: false,
    startClientX: 0,
    startScrollLeft: 0,
  });
  const suppressClickRef = useRef(false);

  const handleMouseDown = useCallback<MouseEventHandler<HTMLDivElement>>(
    (event) => {
      onMouseDown?.(event);
      if (event.defaultPrevented || event.button !== 0) {
        return;
      }

      dragStateRef.current = {
        isDragging: true,
        startClientX: event.clientX,
        startScrollLeft: event.currentTarget.scrollLeft,
      };
      suppressClickRef.current = false;
      event.preventDefault();
    },
    [onMouseDown],
  );

  const handleMouseMove = useCallback<MouseEventHandler<HTMLDivElement>>(
    (event) => {
      onMouseMove?.(event);
      if (event.defaultPrevented || !dragStateRef.current.isDragging) {
        return;
      }

      const deltaX = event.clientX - dragStateRef.current.startClientX;
      if (Math.abs(deltaX) > DRAG_CLICK_SUPPRESSION_THRESHOLD_PX) {
        suppressClickRef.current = true;
      }
      event.currentTarget.scrollLeft = dragStateRef.current.startScrollLeft - deltaX;
      event.preventDefault();
    },
    [onMouseMove],
  );

  const endDrag = useCallback(() => {
    dragStateRef.current.isDragging = false;
  }, []);

  const handleMouseUp = useCallback<MouseEventHandler<HTMLDivElement>>(
    (event) => {
      onMouseUp?.(event);
      if (event.defaultPrevented) {
        return;
      }
      endDrag();
    },
    [endDrag, onMouseUp],
  );

  const handleMouseLeave = useCallback<MouseEventHandler<HTMLDivElement>>(
    (event) => {
      onMouseLeave?.(event);
      if (event.defaultPrevented) {
        return;
      }
      endDrag();
    },
    [endDrag, onMouseLeave],
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
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseLeave}
      onClickCapture={handleClickCapture}
      className={`${CAROUSEL_TRACK_BASE_CLASSES}${className ? ` ${className}` : ''}`}
      {...rest}
    >
      {children}
    </div>
  );
}
