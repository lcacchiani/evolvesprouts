'use client';

import Image from 'next/image';
import { useId, useMemo, useRef } from 'react';

import { BookingConfirmationSummaryTable } from '@/components/sections/booking-modal/booking-confirmation-summary-table';
import {
  CloseButton,
  ModalOverlay,
} from '@/components/sections/booking-modal/shared';
import type { ReservationSummary } from '@/components/sections/booking-modal/types';
import { renderQuotedDescriptionText } from '@/components/sections/shared/render-highlighted-text';
import {
  OverlayDialogPanel,
  OverlayScrollableBody,
} from '@/components/shared/overlay-surface';
import { ButtonPrimitive } from '@/components/shared/button-primitive';
import type { BookingThankYouModalContent, Locale } from '@/content';
import { trackAnalyticsEvent } from '@/lib/analytics';
import { buildBookingConfirmationTableRows } from '@/lib/booking-confirmation-table';
import { formatCurrencyHkd } from '@/lib/format';
import { useModalLockBody } from '@/lib/hooks/use-modal-lock-body';
import { useModalFocusManagement } from '@/lib/hooks/use-modal-focus-management';
import { trackMetaPixelEvent } from '@/lib/meta-pixel';
import { PIXEL_CONTENT_NAME } from '@/lib/meta-pixel-taxonomy';

const WHATSAPP_ICON_SRC = '/images/contact-whatsapp.svg';

export interface BookingThankYouModalProps {
  locale: Locale;
  content: BookingThankYouModalContent;
  summary: ReservationSummary | null;
  analyticsSectionId: string;
  whatsappHref?: string;
  whatsappCtaLabel?: string;
  onClose: () => void;
}

export function BookingThankYouModal({
  locale,
  content,
  summary,
  analyticsSectionId: _analyticsSectionId,
  whatsappHref,
  whatsappCtaLabel,
  onClose,
}: BookingThankYouModalProps) {
  void _analyticsSectionId;
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

  const normalizedWhatsappHref = whatsappHref?.trim() ?? '';
  const normalizedWhatsappLabel = whatsappCtaLabel?.trim() ?? '';
  const showWhatsappFollowUp =
    normalizedWhatsappHref.length > 0 && normalizedWhatsappLabel.length > 0;

  const confirmationRows = useMemo(() => {
    if (!summary) {
      return [];
    }
    return buildBookingConfirmationTableRows({
      courseLabel: summary.eventTitle || content.courseLabel,
      labels: content.confirmationTable,
      detailsPrefixes: content.confirmationDetailsPrefixes,
      courseSlug: summary.courseSlug,
      scheduleDateLabel: summary.scheduleDateLabel,
      scheduleTimeLabel: summary.scheduleTimeLabel,
      primarySessionIso: summary.primarySessionStartIso ?? summary.dateStartTime,
      ageGroupLabel: summary.ageGroup,
      consultationWritingFocusLabel: summary.consultationWritingFocusLabel,
      consultationLevelLabel: summary.consultationLevelLabel,
      locationName: summary.locationName,
      locationAddress: summary.locationAddress,
      paymentMethodCode: summary.paymentMethodCode,
      totalAmountFormatted: formatCurrencyHkd(summary.totalAmount, locale),
    });
  }, [summary, content.courseLabel, content.confirmationTable, content.confirmationDetailsPrefixes, locale]);

  const showPendingPaymentBlock =
    Boolean(summary?.reservationPendingUntilPaymentConfirmed);
  const showFpsQrBlock =
    showPendingPaymentBlock
    && summary?.paymentMethodCode === 'fps_qr'
    && Boolean(summary.fpsQrImageDataUrl?.trim());

  const fpsQrSrc = summary?.fpsQrImageDataUrl?.trim() ?? '';

  return (
    <ModalOverlay
      onClose={onClose}
      overlayAriaLabel={content.closeLabel}
    >
      <OverlayDialogPanel
        panelRef={modalPanelRef}
        ariaLabelledBy={dialogTitleId}
        ariaDescribedBy={dialogDescriptionId}
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
          <div className='relative z-10 flex flex-col items-center px-4 pb-2 pt-0 text-center sm:px-8 sm:pt-2'>
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
            <h2
              id={dialogTitleId}
              className='mt-4 text-2xl font-semibold es-text-heading'
            >
              {content.successTitle}
            </h2>
            <p
              id={dialogDescriptionId}
              className='mt-3 max-w-[610px] text-base leading-7 text-[color:var(--site-primary-text)]'
            >
              {renderQuotedDescriptionText(content.successDescription)}
            </p>
          </div>

          {confirmationRows.length > 0 ? (
            <section
              className='relative z-10 mx-auto mt-8 w-full max-w-[713px] px-4 sm:px-8'
              aria-label={content.confirmationTableSectionLabel}
            >
              <BookingConfirmationSummaryTable
                rows={confirmationRows}
                caption={content.confirmationTableSectionLabel}
              />

              {showPendingPaymentBlock ? (
                <p className='es-booking-thank-you-pending-note mt-4 rounded-card-lg px-4 py-3 text-left text-base leading-7'>
                  {content.pendingPaymentNote}
                </p>
              ) : null}

              {showFpsQrBlock ? (
                <div className='mt-6 text-left'>
                  <p className='text-base leading-7 text-[color:var(--site-primary-text)]'>
                    {content.fpsQrIntro}
                  </p>
                  <p className='mt-2 text-sm leading-6 es-text-neutral-strong'>
                    {content.fpsQrDisclaimer}
                  </p>
                  <div className='mt-4 flex justify-center sm:justify-start'>
                    <Image
                      src={fpsQrSrc}
                      width={128}
                      height={128}
                      alt={content.fpsQrImageAlt}
                      unoptimized
                      className='es-booking-thank-you-fps-qr inline-block'
                    />
                  </div>
                </div>
              ) : null}
            </section>
          ) : null}

          {showWhatsappFollowUp ? (
            <div className='relative z-10 mx-auto mt-8 max-w-[713px] px-4 pb-8 text-center sm:px-8'>
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
          ) : (
            <div className='pb-8' aria-hidden='true' />
          )}
        </OverlayScrollableBody>
      </OverlayDialogPanel>
    </ModalOverlay>
  );
}
