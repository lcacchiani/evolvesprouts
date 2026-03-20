'use client';

import Image from 'next/image';
import { useId, useRef } from 'react';

import { ExternalLinkInlineContent } from '@/components/shared/external-link-icon';
import { ButtonPrimitive } from '@/components/shared/button-primitive';
import { SmartLink } from '@/components/shared/smart-link';
import {
  OverlayDialogPanel,
  OverlayScrollableBody,
} from '@/components/shared/overlay-surface';
import {
  CloseButton,
  ModalOverlay,
} from '@/components/sections/booking-modal/shared';
import type { ReservationSummary } from '@/components/sections/booking-modal/types';
import type { BookingThankYouModalContent, Locale } from '@/content';
import { trackAnalyticsEvent } from '@/lib/analytics';
import { formatCurrencyHkd } from '@/lib/format';
import {
  formatSiteCompactDate,
  formatSiteTimeOfDay,
} from '@/lib/site-datetime';
import { useModalLockBody } from '@/lib/hooks/use-modal-lock-body';
import { useModalFocusManagement } from '@/lib/hooks/use-modal-focus-management';
import { trackMetaPixelEvent } from '@/lib/meta-pixel';
import { getHrefKind } from '@/lib/url-utils';

export interface MyBestAuntieThankYouModalProps {
  locale: Locale;
  content: BookingThankYouModalContent;
  summary: ReservationSummary | null;
  whatsappHref?: string;
  whatsappCtaLabel?: string;
  onClose: () => void;
}

const WHATSAPP_ICON_SRC = '/images/contact-whatsapp.svg';
const THANK_YOU_EVENT_ICON_SRC = '/images/training.svg';
const THANK_YOU_CALENDAR_ICON_SRC = '/images/calendar.svg';
const THANK_YOU_LOCATION_ICON_SRC = '/images/location.svg';
const THANK_YOU_PRICE_ICON_SRC = '/images/dollar-symbol.svg';

function ThankYouDetailCardIcon({ src }: { src: string }) {
  return (
    <span className='inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-2xl es-booking-thank-you-detail-card-icon-wrap'>
      <Image
        src={src}
        alt=''
        width={28}
        height={28}
        className='es-booking-thank-you-detail-card-icon h-7 w-7'
        aria-hidden='true'
      />
    </span>
  );
}

function formatSummaryDatePart(dateStartTime: string | undefined, locale: Locale): string {
  const normalized = dateStartTime?.trim() ?? '';
  if (!normalized) {
    return '';
  }

  return formatSiteCompactDate(normalized, locale);
}

function formatSummaryTimePart(dateStartTime: string | undefined, locale: Locale): string {
  const normalized = dateStartTime?.trim() ?? '';
  if (!normalized) {
    return '';
  }

  return formatSiteTimeOfDay(normalized, locale);
}

function formatSummaryDateTimeLine(
  dateStartTime: string | undefined,
  locale: Locale,
): string {
  const datePart = formatSummaryDatePart(dateStartTime, locale);
  const timePart = formatSummaryTimePart(dateStartTime, locale);
  if (datePart && timePart) {
    return `${datePart}, ${timePart}`;
  }

  return datePart || timePart;
}

function resolveThankYouLocationDisplay(
  summary: ReservationSummary | null,
  virtualFallback: string,
): string {
  const name = summary?.locationName?.trim() ?? '';
  const address = summary?.locationAddress?.trim() ?? '';
  const segments = [name, address].filter(Boolean);
  if (segments.length > 0) {
    return segments.join(', ');
  }

  return virtualFallback;
}

export function MyBestAuntieThankYouModal({
  locale,
  content,
  summary,
  whatsappHref,
  whatsappCtaLabel,
  onClose,
}: MyBestAuntieThankYouModalProps) {
  const modalPanelRef = useRef<HTMLElement | null>(null);
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);
  const dialogTitleId = useId();
  const dialogSuccessId = useId();
  const dialogDescriptionId = useId();

  useModalLockBody({ onEscape: onClose });
  useModalFocusManagement({
    isActive: true,
    containerRef: modalPanelRef,
    initialFocusRef: closeButtonRef,
    restoreFocus: true,
  });

  const subtitleText = content.subtitle?.trim() ?? '';
  const hasSubtitleBlock = subtitleText.length > 0;
  const attendeeEmail = summary?.attendeeEmail ?? '';
  const eventTitle = summary?.eventTitle ?? content.courseLabel;
  const dateTimeLine = formatSummaryDateTimeLine(summary?.dateStartTime, locale);
  const locationLine = resolveThankYouLocationDisplay(
    summary,
    content.summaryLocationVirtualFallback,
  );
  const amountLine = summary
    ? formatCurrencyHkd(summary.totalAmount, locale)
    : content.summaryEmptyValue;
  const dateTimeDisplay = dateTimeLine || content.summaryEmptyValue;
  const locationNameRaw = summary?.locationName?.trim() ?? '';
  const locationAddressRaw = summary?.locationAddress?.trim() ?? '';
  const hasStructuredVenue =
    locationNameRaw.length > 0 || locationAddressRaw.length > 0;
  const directionHref = summary?.locationDirectionHref?.trim() ?? '';
  const showDirectionsLink =
    hasStructuredVenue && getHrefKind(directionHref) === 'http';

  const describedByIds = hasSubtitleBlock
    ? `${dialogSuccessId} ${dialogDescriptionId}`
    : dialogSuccessId;

  const normalizedWhatsappHref = whatsappHref?.trim() ?? '';
  const normalizedWhatsappLabel = whatsappCtaLabel?.trim() ?? '';
  const showWhatsappFollowUp =
    normalizedWhatsappHref.length > 0 && normalizedWhatsappLabel.length > 0;

  return (
    <ModalOverlay
      onClose={onClose}
      overlayAriaLabel={content.closeLabel}
    >
      <OverlayDialogPanel
        panelRef={modalPanelRef}
        ariaLabelledBy={dialogTitleId}
        ariaDescribedBy={describedByIds}
        tabIndex={-1}
        className='es-my-best-auntie-thank-you-panel'
      >
        <header className='flex justify-end px-4 pb-6 pt-6 sm:px-8 sm:pt-7'>
          <CloseButton
            label={content.closeLabel}
            onClose={onClose}
            buttonRef={closeButtonRef}
          />
        </header>

        <OverlayScrollableBody>
          <div className='relative z-10 flex flex-col items-center pt-0 text-center sm:pt-6 lg:pt-14'>
            <div className='flex h-[100px] w-[100px] items-center justify-center rounded-full es-bg-surface-success-soft'>
              <Image
                src='/images/green-tick-icon.png'
                alt=''
                width={124}
                height={124}
                className='h-[55px] w-[55px]'
                aria-hidden='true'
              />
            </div>
            <h3
              id={dialogSuccessId}
              className='mt-3 text-[22px] font-normal leading-none es-text-heading sm:text-[28px]'
            >
              {content.successLabel}
            </h3>
            <h2
              id={dialogTitleId}
              className='es-type-title mt-2 max-w-[610px] leading-[1.1] es-my-best-auntie-thank-you-heading'
            >
              {content.title}
            </h2>
            {hasSubtitleBlock ? (
              <p
                id={dialogDescriptionId}
                className='mt-3 text-lg leading-7 es-my-best-auntie-thank-you-body'
              >
                {content.subtitle}
                {' '}
                <span className='font-semibold es-text-emphasis'>
                  {attendeeEmail}
                </span>
              </p>
            ) : null}
          </div>

          <section className='relative z-10 mx-auto mt-10 w-full max-w-[713px] px-4 sm:px-0'>
            <div className='grid grid-cols-2 gap-3 sm:gap-5'>
              <article className='flex h-full min-h-[200px] flex-col rounded-card-xl p-4 sm:p-8 es-booking-thank-you-detail-card'>
                <div className='flex w-full justify-center'>
                  <ThankYouDetailCardIcon src={THANK_YOU_EVENT_ICON_SRC} />
                </div>
                <p className='mt-3 text-center es-booking-thank-you-detail-card-description'>
                  {eventTitle}
                </p>
              </article>

              <article className='flex h-full min-h-[200px] flex-col rounded-card-xl p-4 sm:p-8 es-booking-thank-you-detail-card'>
                <div className='flex w-full justify-center'>
                  <ThankYouDetailCardIcon src={THANK_YOU_CALENDAR_ICON_SRC} />
                </div>
                <p className='mt-3 text-center es-booking-thank-you-detail-card-description'>
                  {dateTimeDisplay}
                </p>
              </article>

              <article className='flex h-full min-h-[200px] flex-col rounded-card-xl p-4 sm:p-8 es-booking-thank-you-detail-card'>
                <div className='flex w-full justify-center'>
                  <ThankYouDetailCardIcon src={THANK_YOU_LOCATION_ICON_SRC} />
                </div>
                <div className='mt-3 flex w-full flex-col items-center text-center'>
                  {hasStructuredVenue ? (
                    <>
                      {locationNameRaw ? (
                        <p className='font-semibold es-booking-thank-you-detail-card-description'>
                          {locationNameRaw}
                        </p>
                      ) : null}
                      {locationAddressRaw ? (
                        <p
                          className={
                            locationNameRaw
                              ? 'mt-1 es-booking-thank-you-detail-card-description'
                              : 'es-booking-thank-you-detail-card-description'
                          }
                        >
                          {locationAddressRaw}
                        </p>
                      ) : null}
                    </>
                  ) : (
                    <p className='es-booking-thank-you-detail-card-description'>
                      {locationLine}
                    </p>
                  )}
                  {showDirectionsLink ? (
                    <SmartLink
                      href={directionHref}
                      className='mt-3 inline-flex items-center text-base font-semibold leading-none es-text-heading'
                    >
                      {({ isExternalHttp }) => (
                        <ExternalLinkInlineContent
                          isExternalHttp={isExternalHttp}
                          externalLabelClassName='es-link-external-label--direction'
                        >
                          {content.directionLabel}
                        </ExternalLinkInlineContent>
                      )}
                    </SmartLink>
                  ) : null}
                </div>
              </article>

              <article className='flex h-full min-h-[200px] flex-col rounded-card-xl p-4 sm:p-8 es-booking-thank-you-detail-card'>
                <div className='flex w-full justify-center'>
                  <ThankYouDetailCardIcon src={THANK_YOU_PRICE_ICON_SRC} />
                </div>
                <p className='mt-3 text-center es-booking-thank-you-detail-card-description'>
                  {amountLine}
                </p>
              </article>
            </div>
          </section>

          {showWhatsappFollowUp ? (
            <div className='relative z-10 mx-auto mt-8 max-w-[713px] text-center'>
              <p className='text-lg leading-7 es-my-best-auntie-thank-you-body'>
                {content.followUpPrompt}
              </p>
              <ButtonPrimitive
                variant='primary'
                href={normalizedWhatsappHref}
                openInNewTab
                className='mt-4 w-full sm:w-auto es-btn--whatsapp-cta'
                onClick={() => {
                  trackAnalyticsEvent('whatsapp_click', {
                    sectionId: 'booking-thank-you-modal',
                    ctaLocation: 'thank_you_follow_up',
                  });
                  trackMetaPixelEvent('Contact', { content_name: 'whatsapp' });
                }}
              >
                <span>{normalizedWhatsappLabel}</span>
                <Image
                  src={WHATSAPP_ICON_SRC}
                  alt=''
                  aria-hidden='true'
                  width={16}
                  height={16}
                  className='h-4 w-4 shrink-0'
                />
              </ButtonPrimitive>
            </div>
          ) : null}
        </OverlayScrollableBody>
      </OverlayDialogPanel>
    </ModalOverlay>
  );
}
