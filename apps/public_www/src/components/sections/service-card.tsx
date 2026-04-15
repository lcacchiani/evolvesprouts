'use client';

import {
  type KeyboardEvent,
  type MouseEvent,
  useCallback,
  useRef,
  useState,
} from 'react';
import Image from 'next/image';

import { ButtonPrimitive } from '@/components/shared/button-primitive';
import { renderQuotedDescriptionText } from '@/components/sections/shared/render-highlighted-text';
import enContent from '@/content/en.json';
import { formatContentTemplate } from '@/content/content-field-utils';
import { useOutsideClickClose } from '@/lib/hooks/use-outside-click-close';

const DESKTOP_HOVER_QUERY = '(min-width: 1024px) and (hover: hover)';

export type ServiceCardTone = 'gold' | 'green' | 'blue';

export interface ServiceCardProps {
  id: string;
  title: string;
  imageSrc: string;
  imageWidth: number;
  imageHeight: number;
  imageClassName: string;
  description?: string;
  tone: ServiceCardTone;
  showDetailsLabelTemplate?: string;
}

const INTERACTIVE_ELEMENT_SELECTOR =
  'button, a, input, select, textarea';

function isDesktopHoverMode(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return false;
  }

  return window.matchMedia(DESKTOP_HOVER_QUERY).matches;
}

export function ServiceCard({
  title,
  imageSrc,
  imageWidth,
  imageHeight,
  imageClassName,
  description,
  tone,
  showDetailsLabelTemplate = enContent.services.showDetailsAriaLabelTemplate,
}: ServiceCardProps) {
  const [isActive, setIsActive] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);
  const toneClassMap: Record<ServiceCardTone, string> = {
    gold: 'es-service-card--gold',
    green: 'es-service-card--green',
    blue: 'es-service-card--blue',
  };
  const toneClassName = toneClassMap[tone];

  const handleDismiss = useCallback(() => {
    setIsActive(false);
  }, []);

  useOutsideClickClose({
    ref: cardRef,
    onOutsideClick: handleDismiss,
    isActive,
  });

  const handleArrowClick = useCallback(() => {
    setIsActive((prev) => !prev);
  }, []);

  const handleCardSurfaceClick = useCallback(
    (event: MouseEvent<HTMLElement>) => {
      const clickTarget = event.target as HTMLElement | null;
      if (clickTarget?.closest(INTERACTIVE_ELEMENT_SELECTOR)) {
        return;
      }

      if (isDesktopHoverMode()) {
        return;
      }

      setIsActive((prev) => !prev);
    },
    [],
  );

  const handleCardSurfaceKeyDown = useCallback(
    (event: KeyboardEvent<HTMLElement>) => {
      const keyTarget = event.target as HTMLElement | null;
      if (keyTarget?.closest(INTERACTIVE_ELEMENT_SELECTOR)) {
        return;
      }

      if (event.key !== 'Enter' && event.key !== ' ') {
        return;
      }

      if (isDesktopHoverMode()) {
        return;
      }

      event.preventDefault();
      setIsActive((prev) => !prev);
    },
    [],
  );

  // Build conditional class fragments for the active (tapped) state.
  // Pointer hover continues to work independently via group-hover:*.
  const overlayActive = isActive
    ? 'bg-black/70 backdrop-blur-[4px]'
    : '';
  const arrowActive = isActive
    ? 'h-[70px] w-[70px]'
    : '';
  const descriptionVisibilityClassName = isActive
    ? 'opacity-100 transition-opacity duration-300'
    : 'opacity-0 transition-none';

  return (
    <div
      ref={cardRef}
      role='button'
      tabIndex={0}
      aria-expanded={isActive}
      onClick={handleCardSurfaceClick}
      onKeyDown={handleCardSurfaceKeyDown}
      className={`group relative isolate flex min-h-[320px] overflow-hidden rounded-card p-5 sm:min-h-[345px] sm:p-7 lg:min-h-[457px] lg:p-8 ${toneClassName}`}
    >
      {/* Dark overlay - activated by pointer hover or tap */}
      <div
        aria-hidden='true'
        className={`pointer-events-none absolute inset-0 z-[1] transition-all duration-300 ${isActive ? '' : 'bg-black/0'} group-hover:bg-black/70 group-hover:backdrop-blur-[4px] ${overlayActive}`}
      />

      {/* Card illustration */}
      <div
        aria-hidden='true'
        className='pointer-events-none absolute bottom-0 right-0 z-0'
      >
        <Image
          src={imageSrc}
          alt=''
          width={imageWidth}
          height={imageHeight}
          sizes='(max-width: 640px) 240px, (max-width: 1024px) 300px, 340px'
          className={`${imageClassName} w-auto max-w-none`}
        />
      </div>

      {/* Arrow button - triggers reveal on tap */}
      <ButtonPrimitive
        variant='icon'
        aria-label={formatContentTemplate(showDetailsLabelTemplate, { title })}
        aria-expanded={isActive}
        onClick={handleArrowClick}
        className={`absolute bottom-5 left-5 z-10 appearance-none rounded-full border-0 bg-white/15 p-0 ring-1 ring-white/35 transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/80 lg:bottom-7 lg:left-7 ${isActive ? 'h-[70px] w-[70px]' : 'h-[54px] w-[54px]'} group-hover:h-[70px] group-hover:w-[70px] ${arrowActive}`}
      >
        <span className='inline-flex h-[44px] w-[44px] items-center justify-center rounded-full es-bg-brand-strong shadow-[0_4px_10px_rgba(0,0,0,0.18)]'>
          <span
            aria-hidden
            className='es-ui-icon-mask es-ui-icon-mask--chevron-right inline-block h-4 w-4 shrink-0 text-[var(--figma-colors-desktop,#FFFFFF)]'
          />
        </span>
      </ButtonPrimitive>

      {/* Card text content */}
      <div className='relative z-10 flex h-full w-full flex-col'>
        <div className='mt-auto space-y-4'>
          <h3 className='max-w-[12ch] text-balance es-service-card-title'>
            {title}
          </h3>

          {description && (
            <p
              className={`max-w-[34ch] es-service-card-description group-hover:opacity-100 group-hover:transition-opacity group-hover:duration-300 ${descriptionVisibilityClassName}`}
            >
              {renderQuotedDescriptionText(description)}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
