'use client';

import Image from 'next/image';
import { useId, useMemo, useRef } from 'react';

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
import type {
  ReservationCourseSession,
  ReservationSummary,
} from '@/components/sections/booking-modal/types';
import type { BookingThankYouModalContent, Locale } from '@/content';
import { formatContentTemplate } from '@/content/content-field-utils';
import { trackAnalyticsEvent } from '@/lib/analytics';
import {
  buildBookingIcsCalendarContent,
  buildEvolveSproutsThankYouIcsFilenameBase,
  triggerBookingIcsDownload,
} from '@/lib/booking-calendar-download';
import { formatCurrencyHkd } from '@/lib/format';
import {
  formatPartDateTimeLabel,
  formatSiteAmPmIndicator,
  formatSitePartDate,
} from '@/lib/site-datetime';
import { useModalLockBody } from '@/lib/hooks/use-modal-lock-body';
import { useModalFocusManagement } from '@/lib/hooks/use-modal-focus-management';
import { trackMetaPixelEvent } from '@/lib/meta-pixel';
import { PIXEL_CONTENT_NAME } from '@/lib/meta-pixel-taxonomy';
import { getHrefKind } from '@/lib/url-utils';

const THANK_YOU_ICS_DOWNLOAD_CLASSNAME =
  'es-footer-link mt-3 inline-block cursor-pointer rounded-none border-0 bg-transparent p-0 text-left text-base font-semibold underline decoration-1 underline-offset-2 transition-opacity hover:opacity-70 disabled:cursor-not-allowed disabled:opacity-50';

export interface BookingThankYouModalProps {
  locale: Locale;
  content: BookingThankYouModalContent;
  summary: ReservationSummary | null;
  analyticsSectionId: string;
  whatsappHref?: string;
  whatsappCtaLabel?: string;
  onClose: () => void;
}

const WHATSAPP_ICON_SRC = '/images/contact-whatsapp.svg';

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

function resolveThankYouCourseSessions(summary: ReservationSummary | null): ReservationCourseSession[] {
  if (!summary) {
    return [];
  }

  if (summary.courseSessions && summary.courseSessions.length > 0) {
    return summary.courseSessions;
  }

  const start = summary.dateStartTime?.trim() ?? '';
  if (!start) {
    return [];
  }

  return [
    {
      dateStartTime: start,
      dateEndTime: summary.dateEndTime?.trim() || undefined,
    },
  ];
}

function splitMessageTemplate(template: string): { before: string; after: string } {
  const marker = '{email}';
  const index = template.indexOf(marker);
  if (index === -1) {
    return { before: template, after: '' };
  }

  return {
    before: template.slice(0, index),
    after: template.slice(index + marker.length),
  };
}

function buildThankYouDateTimeLines(
  summary: ReservationSummary | null,
  thankYouSessions: ReservationCourseSession[],
  locale: Locale,
  content: BookingThankYouModalContent,
): string[] {
  if (!summary || thankYouSessions.length === 0) {
    return [];
  }

  const slug = (summary.courseSlug ?? '').trim().toLowerCase();
  if (slug === 'my-best-auntie') {
    const ordinals = content.groupSessionOrdinals;
    return thankYouSessions
      .map((session, index) => {
        const dateTime = formatPartDateTimeLabel(session.dateStartTime, locale);
        if (!dateTime) {
          return '';
        }

        const ordinal = ordinals[index]?.trim() ?? '';
        if (!ordinal) {
          return dateTime;
        }

        return formatContentTemplate(content.groupSessionLabelTemplate, {
          ordinal,
          dateTime,
        });
      })
      .filter((line) => line.length > 0);
  }

  if (slug === 'consultation-booking') {
    const session = thankYouSessions[0];
    if (!session) {
      return [];
    }

    const datePart = formatSitePartDate(session.dateStartTime, locale);
    const amPm = formatSiteAmPmIndicator(session.dateStartTime, locale);
    if (!datePart || !amPm) {
      return [];
    }

    return [`${datePart} ${amPm}`];
  }

  return thankYouSessions
    .map((session) => formatPartDateTimeLabel(session.dateStartTime, locale))
    .filter((line) => line.length > 0);
}

export function BookingThankYouModal({
  locale,
  content,
  summary,
  analyticsSectionId,
  whatsappHref,
  whatsappCtaLabel,
  onClose,
}: BookingThankYouModalProps) {
  const modalPanelRef = useRef<HTMLElement | null>(null);
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);
  const dialogTitleId = useId();
  const dialogDescriptionId = useId();

  useModalLockBody({ onEscape: onClose });
  useModalFocusManagement({
    isActive: true,
    containerRef: modalPanelRef,
    initialFocusRef: closeButtonRef,
    restoreFocus: true,
  });

  const attendeeEmail = summary?.attendeeEmail ?? '';
  const eventTitle = summary?.eventTitle ?? content.courseLabel;
  const thankYouSessions = useMemo(
    () => resolveThankYouCourseSessions(summary),
    [summary],
  );
  const dateTimeLines = useMemo(() => {
    return buildThankYouDateTimeLines(summary, thankYouSessions, locale, content);
  }, [summary, thankYouSessions, locale, content]);

  const locationLine = resolveThankYouLocationDisplay(
    summary,
    content.summaryLocationVirtualFallback,
  );
  const isFreeReservation =
    summary?.paymentMethodCode === 'free' || summary?.totalAmount === 0;
  const amountLine = summary
    ? isFreeReservation
      ? content.freeTotalLabel
      : formatCurrencyHkd(summary.totalAmount, locale)
    : content.summaryEmptyValue;
  const isFpsPayment = summary?.paymentMethodCode === 'fps_qr';
  const paymentMethodLine = isFpsPayment
    ? content.fpsPaymentLabel
    : (summary?.paymentMethod?.trim() ?? content.summaryEmptyValue);
  const locationNameRaw = summary?.locationName?.trim() ?? '';
  const locationAddressRaw = summary?.locationAddress?.trim() ?? '';
  const hasStructuredVenue =
    locationNameRaw.length > 0 || locationAddressRaw.length > 0;
  const directionHref = summary?.locationDirectionHref?.trim() ?? '';
  const showDirectionsLink =
    hasStructuredVenue && getHrefKind(directionHref) === 'http';

  const detailLines = summary?.detailLines?.filter((line) => line.trim().length > 0) ?? [];
  const showDetailsRow = detailLines.length > 0;
  const showDateTimeRow = dateTimeLines.length > 0;
  const showIcsOnlyRow = Boolean(summary) && !showDateTimeRow;
  const courseSlugNormalized = (summary?.courseSlug ?? '').trim().toLowerCase();
  const isConsultationBooking = courseSlugNormalized === 'consultation-booking';
  const showCalendarDownload = !isConsultationBooking;

  const messageParts = useMemo(() => {
    return splitMessageTemplate(content.messageTemplate);
  }, [content.messageTemplate]);
  const messageExpectsEmail = content.messageTemplate.includes('{email}');
  const hasAttendeeEmail = attendeeEmail.trim().length > 0;
  const showMessageParagraph =
    !messageExpectsEmail || hasAttendeeEmail;

  const normalizedWhatsappHref = whatsappHref?.trim() ?? '';
  const normalizedWhatsappLabel = whatsappCtaLabel?.trim() ?? '';
  const showWhatsappFollowUp =
    normalizedWhatsappHref.length > 0 && normalizedWhatsappLabel.length > 0;

  const icsBody = useMemo(() => {
    if (thankYouSessions.length === 0) {
      return null;
    }

    return buildBookingIcsCalendarContent({
      title: eventTitle,
      location: locationLine,
      sessions: thankYouSessions.map((session) => {
        return {
          dateStartTime: session.dateStartTime,
          dateEndTime: session.dateEndTime,
        };
      }),
    });
  }, [thankYouSessions, eventTitle, locationLine]);

  const canDownloadIcs = Boolean(icsBody);

  function handleDownloadIcs() {
    if (!icsBody || !summary) {
      return;
    }

    const cohortDate =
      thankYouSessions[0]?.dateStartTime.split('T')[0] ?? '';

    trackAnalyticsEvent('booking_thank_you_ics_download', {
      sectionId: analyticsSectionId,
      ctaLocation: 'thank_you_modal',
      params: {
        cohort_date: cohortDate,
        total_amount: summary.totalAmount,
      },
    });

    triggerBookingIcsDownload(
      icsBody,
      buildEvolveSproutsThankYouIcsFilenameBase(eventTitle),
    );
  }

  return (
    <ModalOverlay
      onClose={onClose}
      overlayAriaLabel={content.closeLabel}
    >
      <OverlayDialogPanel
        panelRef={modalPanelRef}
        ariaLabelledBy={dialogTitleId}
        ariaDescribedBy={showMessageParagraph ? dialogDescriptionId : undefined}
        tabIndex={-1}
        className='es-booking-thank-you-panel es-section-bg-overlay es-booking-thank-you-modal-section-bg'
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
            <h2
              id={dialogTitleId}
              className='es-type-title max-w-[610px] leading-[1.1] es-booking-thank-you-heading'
            >
              {content.title}
            </h2>
            {showMessageParagraph ? (
              <p
                id={dialogDescriptionId}
                className='mt-3 text-lg leading-7 es-booking-thank-you-body'
              >
                {messageParts.before}
                <span className='font-semibold es-text-emphasis'>
                  {attendeeEmail}
                </span>
                {messageParts.after}
              </p>
            ) : null}
          </div>

          <section className='relative z-10 mx-auto mt-10 w-full max-w-[713px] px-4 sm:px-0'>
            <dl className='rounded-card-xl p-6 text-left sm:p-8 es-booking-thank-you-recap-card'>
              <div className='es-booking-thank-you-recap-row-border pb-4'>
                <div className='grid grid-cols-1 gap-2 sm:grid-cols-[minmax(0,140px)_1fr] sm:gap-6'>
                  <dt className='es-booking-thank-you-recap-label'>
                    {content.serviceLabel}
                  </dt>
                  <dd className='es-booking-thank-you-recap-value m-0'>
                    {eventTitle}
                  </dd>
                </div>
              </div>

              {showDetailsRow ? (
                <div className='es-booking-thank-you-recap-row-border py-4'>
                  <div className='grid grid-cols-1 gap-2 sm:grid-cols-[minmax(0,140px)_1fr] sm:gap-6'>
                    <dt className='es-booking-thank-you-recap-label'>
                      {content.detailsLabel}
                    </dt>
                    <dd className='es-booking-thank-you-recap-value m-0'>
                      {detailLines.map((line, index) => {
                        return (
                          <span
                            key={`${line}-${index}`}
                            className={
                              index > 0
                                ? 'mt-1 block'
                                : 'block'
                            }
                          >
                            {line}
                          </span>
                        );
                      })}
                    </dd>
                  </div>
                </div>
              ) : null}

              {showDateTimeRow ? (
                <div className='es-booking-thank-you-recap-row-border py-4'>
                  <div className='grid grid-cols-1 gap-2 sm:grid-cols-[minmax(0,140px)_1fr] sm:gap-6'>
                    <dt className='es-booking-thank-you-recap-label'>
                      {content.dateTimeLabel}
                    </dt>
                    <dd className='es-booking-thank-you-recap-value m-0'>
                      {dateTimeLines.map((line, index) => {
                        return (
                          <span
                            key={`${line}-${index}`}
                            className={
                              index > 0
                                ? 'mt-1 block'
                                : 'block'
                            }
                          >
                            {line}
                          </span>
                        );
                      })}
                      {showCalendarDownload ? (
                        <button
                          type='button'
                          disabled={!canDownloadIcs}
                          onClick={handleDownloadIcs}
                          className={THANK_YOU_ICS_DOWNLOAD_CLASSNAME}
                        >
                          {content.downloadCalendarInviteLabel}
                        </button>
                      ) : null}
                    </dd>
                  </div>
                </div>
              ) : null}
              {showIcsOnlyRow && showCalendarDownload ? (
                <div className='es-booking-thank-you-recap-row-border py-4'>
                  <div className='grid grid-cols-1 gap-2 sm:grid-cols-[minmax(0,140px)_1fr] sm:gap-6'>
                    <dt
                      className='hidden sm:block sm:min-w-[140px]'
                      aria-hidden='true'
                    />
                    <dd className='es-booking-thank-you-recap-value m-0'>
                      <button
                        type='button'
                        disabled={!canDownloadIcs}
                        onClick={handleDownloadIcs}
                        className={THANK_YOU_ICS_DOWNLOAD_CLASSNAME}
                      >
                        {content.downloadCalendarInviteLabel}
                      </button>
                    </dd>
                  </div>
                </div>
              ) : null}

              <div className='es-booking-thank-you-recap-row-border py-4'>
                <div className='grid grid-cols-1 gap-2 sm:grid-cols-[minmax(0,140px)_1fr] sm:gap-6'>
                  <dt className='es-booking-thank-you-recap-label'>
                    {content.locationLabel}
                  </dt>
                  <dd className='es-booking-thank-you-recap-value m-0'>
                    {hasStructuredVenue ? (
                      <>
                        {locationNameRaw ? (
                          <span className='block'>{locationNameRaw}</span>
                        ) : null}
                        {locationNameRaw && locationAddressRaw ? (
                          <span className='mt-1 block'>{locationAddressRaw}</span>
                        ) : null}
                        {!locationNameRaw && locationAddressRaw ? (
                          <span className='block'>{locationAddressRaw}</span>
                        ) : null}
                      </>
                    ) : (
                      <span className='block'>{locationLine}</span>
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
                  </dd>
                </div>
              </div>

              {!isFreeReservation ? (
              <div className='es-booking-thank-you-recap-row-border py-4'>
                <div className='grid grid-cols-1 gap-2 sm:grid-cols-[minmax(0,140px)_1fr] sm:gap-6'>
                  <dt className='es-booking-thank-you-recap-label'>
                    {content.paymentMethodLabel}
                  </dt>
                  <dd className='es-booking-thank-you-recap-value m-0'>
                    <span className='block'>{paymentMethodLine}</span>
                    {!isFpsPayment ? (
                      <span className='mt-1 block text-base font-normal leading-6 opacity-80'>
                        {content.paymentConfirmationNote}
                      </span>
                    ) : null}
                  </dd>
                </div>
              </div>
              ) : null}

              <div className='pt-4'>
                <div className='grid grid-cols-1 gap-2 sm:grid-cols-[minmax(0,140px)_1fr] sm:gap-6'>
                  <dt className='es-booking-thank-you-recap-label'>
                    {content.totalLabel}
                  </dt>
                  <dd className='es-booking-thank-you-recap-value m-0'>
                    {isFreeReservation ? (
                      <span className='block es-text-success font-semibold'>{amountLine}</span>
                    ) : (
                    <span className='block'>{amountLine}</span>
                    )}
                    {isFpsPayment ? (
                      <>
                        <span className='mt-3 block text-base font-semibold leading-6'>
                          {content.fpsReservationPendingNote}
                        </span>
                        <span className='mt-1 block text-base font-normal leading-6 opacity-80'>
                          {content.fpsQrInstruction}
                        </span>
                        <span className='mt-1 block text-sm font-normal leading-5 opacity-80'>
                          {content.fpsPaymentDisclaimer}
                        </span>
                        <span className='mt-3 block text-base font-semibold leading-6'>
                          {content.fpsQrCodeAltLabel}
                        </span>
                        {summary?.fpsQrImageDataUrl ? (
                          <Image
                            src={summary.fpsQrImageDataUrl}
                            alt=''
                            aria-hidden='true'
                            width={128}
                            height={128}
                            unoptimized
                            className='mt-2 block h-32 w-32'
                          />
                        ) : null}
                      </>
                    ) : null}
                  </dd>
                </div>
              </div>
            </dl>
          </section>

          {showWhatsappFollowUp ? (
            <div className='relative z-10 mx-auto mt-8 max-w-[713px] text-center'>
              <p className='text-lg leading-7 es-booking-thank-you-body'>
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
                  trackMetaPixelEvent('Contact', { content_name: PIXEL_CONTENT_NAME.whatsapp });
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
