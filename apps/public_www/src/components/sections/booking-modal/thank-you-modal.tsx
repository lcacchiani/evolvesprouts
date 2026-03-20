'use client';

import Image from 'next/image';
import { useId, useRef } from 'react';

import { ButtonPrimitive } from '@/components/shared/button-primitive';
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
import {
  buildBookingIcsContent,
  triggerBookingIcsDownload,
} from '@/lib/booking-calendar-download';
import { formatCurrencyHkd } from '@/lib/format';
import {
  formatSiteCompactDate,
  formatSiteTimeOfDay,
} from '@/lib/site-datetime';
import { useModalLockBody } from '@/lib/hooks/use-modal-lock-body';
import { useModalFocusManagement } from '@/lib/hooks/use-modal-focus-management';
import { trackMetaPixelEvent } from '@/lib/meta-pixel';

export interface MyBestAuntieThankYouModalProps {
  locale: Locale;
  content: BookingThankYouModalContent;
  summary: ReservationSummary | null;
  analyticsSectionId?: string;
  whatsappHref?: string;
  whatsappCtaLabel?: string;
  onClose: () => void;
}

const WHATSAPP_ICON_SRC = '/images/contact-whatsapp.svg';

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
  analyticsSectionId = 'my-best-auntie-booking',
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

  const describedByIds = hasSubtitleBlock
    ? `${dialogSuccessId} ${dialogDescriptionId}`
    : dialogSuccessId;

  const normalizedWhatsappHref = whatsappHref?.trim() ?? '';
  const normalizedWhatsappLabel = whatsappCtaLabel?.trim() ?? '';
  const showWhatsappFollowUp =
    normalizedWhatsappHref.length > 0 && normalizedWhatsappLabel.length > 0;

  const icsBody =
    summary?.dateStartTime
      ? buildBookingIcsContent({
          title: eventTitle,
          dateStartTime: summary.dateStartTime,
          dateEndTime: summary.dateEndTime,
          location: locationLine,
        })
      : null;
  const canDownloadIcs = Boolean(icsBody);

  function handleDownloadIcs() {
    if (!icsBody || !summary?.dateStartTime) {
      return;
    }

    trackAnalyticsEvent('booking_thank_you_ics_download', {
      sectionId: analyticsSectionId,
      ctaLocation: 'thank_you_modal',
      params: {
        cohort_date: summary.dateStartTime.split('T')[0] ?? '',
        total_amount: summary.totalAmount,
      },
    });

    triggerBookingIcsDownload(icsBody, eventTitle);
  }

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

          <section className='relative z-10 mx-auto mt-10 max-w-[713px] overflow-hidden rounded-2xl border es-border-panel es-bg-surface-muted px-4 py-7 shadow-[0_9px_9px_rgba(49,86,153,0.08),0_9px_18px_rgba(49,86,153,0.06)] sm:px-8 sm:py-10'>
            <h4 className='relative z-10 text-left text-lg font-semibold es-text-heading'>
              {content.summaryHeading}
            </h4>
            <dl className='relative z-10 mt-6 space-y-4 text-left'>
              <div>
                <dt className='text-sm font-medium es-text-muted'>
                  {content.summaryEventLabel}
                </dt>
                <dd className='mt-1 text-base es-text-body'>
                  {eventTitle}
                </dd>
              </div>
              <div>
                <dt className='text-sm font-medium es-text-muted'>
                  {content.summaryDateTimeLabel}
                </dt>
                <dd className='mt-1 text-base es-text-body'>
                  {dateTimeDisplay}
                </dd>
              </div>
              <div>
                <dt className='text-sm font-medium es-text-muted'>
                  {content.summaryLocationLabel}
                </dt>
                <dd className='mt-1 text-base es-text-body'>
                  {locationLine}
                </dd>
              </div>
              <div>
                <dt className='text-sm font-medium es-text-muted'>
                  {content.summaryAmountLabel}
                </dt>
                <dd className='mt-1 text-base es-text-body'>
                  {amountLine}
                </dd>
              </div>
            </dl>

            <div className='relative z-10 mt-8'>
              <ButtonPrimitive
                variant='outline'
                type='button'
                disabled={!canDownloadIcs}
                onClick={handleDownloadIcs}
                className='h-[54px] w-full rounded-control px-6 text-[16px] font-semibold sm:h-[60px] sm:text-[18px]'
              >
                {content.downloadCalendarLabel}
              </ButtonPrimitive>
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
