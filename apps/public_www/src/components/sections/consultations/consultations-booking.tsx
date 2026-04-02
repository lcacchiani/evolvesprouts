'use client';

import dynamic from 'next/dynamic';
import { useState } from 'react';

import type { ReservationSummary } from '@/components/sections/booking-modal/types';
import {
  buildSectionSplitLayoutClassName,
  SectionContainer,
} from '@/components/sections/shared/section-container';
import { SectionHeader } from '@/components/sections/shared/section-header';
import { SectionShell } from '@/components/sections/shared/section-shell';
import { ButtonPrimitive } from '@/components/shared/button-primitive';
import type {
  BookingModalContent,
  ConsultationsBookingContent,
  Locale,
} from '@/content';
import { buildConsultationsBookingModalPayload } from '@/lib/consultations-booking-modal-payload';
import { PIXEL_CONTENT_NAME } from '@/lib/meta-pixel-taxonomy';

const EventBookingModal = dynamic(
  () =>
    import('@/components/sections/events/event-booking-modal').then(
      (module) => module.EventBookingModal,
    ),
  { ssr: false },
);

const BookingThankYouModal = dynamic(
  () =>
    import('@/components/sections/booking-modal/thank-you-modal').then(
      (module) => module.BookingThankYouModal,
    ),
  { ssr: false },
);

interface ConsultationsBookingProps {
  locale: Locale;
  content: ConsultationsBookingContent;
  bookingModalContent: BookingModalContent;
  thankYouWhatsappHref?: string;
  thankYouWhatsappCtaLabel?: string;
}

export function ConsultationsBooking({
  locale,
  content,
  bookingModalContent,
  thankYouWhatsappHref,
  thankYouWhatsappCtaLabel,
}: ConsultationsBookingProps) {
  const [isBookingModalOpen, setIsBookingModalOpen] = useState(false);
  const [thankYouSummary, setThankYouSummary] = useState<ReservationSummary | null>(
    null,
  );
  const [isThankYouOpen, setIsThankYouOpen] = useState(false);

  const bookingPayload = isBookingModalOpen
    ? buildConsultationsBookingModalPayload(content.reservation, locale)
    : null;

  return (
    <>
      <SectionShell
        id='consultations-booking'
        ariaLabel={content.title}
        dataFigmaNode='consultations-booking'
        className='es-section-bg-overlay'
      >
        <SectionContainer>
          <SectionHeader eyebrow={content.eyebrow} title={content.title} />

          <div className='mt-12'>
            <h3 className='text-xl font-semibold es-type-body'>
              {content.step1Title}
            </h3>
            <div className='mt-6 grid grid-cols-1 gap-6 md:grid-cols-3'>
              {content.focusAreas.map((area) => (
                <article
                  key={area.id}
                  className='rounded-3xl es-bg-surface-muted px-6 py-7 sm:px-8 sm:py-8'
                >
                  <span className='text-3xl' aria-hidden='true'>
                    {area.icon}
                  </span>
                  <h4 className='mt-3 text-lg font-bold es-text-heading'>
                    {area.title}
                  </h4>
                  <p className='mt-2 es-type-body es-text-dim'>
                    {area.description}
                  </p>
                </article>
              ))}
            </div>
          </div>

          <div className='mt-12'>
            <h3 className='text-xl font-semibold es-type-body'>
              {content.step2Title}
            </h3>
            <div className='mt-6 grid grid-cols-1 gap-6 md:grid-cols-2'>
              {content.levels.map((level) => (
                <article
                  key={level.id}
                  className='rounded-3xl border es-border-soft es-bg-surface-neutral px-6 py-7 sm:px-8 sm:py-8'
                >
                  <div className='flex items-center gap-3'>
                    <span className='text-lg es-text-accent' aria-hidden='true'>
                      {level.badge}
                    </span>
                    <h4 className='text-lg font-bold es-text-heading'>
                      {level.title}
                    </h4>
                  </div>
                  {'includesLabel' in level && level.includesLabel && (
                    <p className='mt-3 text-sm font-medium es-text-dim'>
                      {level.includesLabel}
                    </p>
                  )}
                  <ul className='mt-3 space-y-2'>
                    {level.features.map((feature, index) => (
                      <li
                        key={`${level.id}-feature-${index}`}
                        className='flex items-start gap-2 es-type-body es-text-dim'
                      >
                        <span
                          className='mt-1 inline-block h-2 w-2 shrink-0 rounded-full es-bg-accent'
                          aria-hidden='true'
                        />
                        {feature}
                      </li>
                    ))}
                  </ul>
                  <p className='mt-4 text-sm italic es-text-muted'>
                    {level.bestFor}
                  </p>
                </article>
              ))}
            </div>
          </div>

          <div
            className={buildSectionSplitLayoutClassName(
              'mt-12 flex flex-col sm:flex-row',
            )}
          >
            <ButtonPrimitive
              type='button'
              variant='primary'
              className='max-w-full sm:max-w-[360px]'
              onClick={() => {
                setIsBookingModalOpen(true);
              }}
            >
              {content.reservation.ctaLabel}
            </ButtonPrimitive>
          </div>
        </SectionContainer>
      </SectionShell>

      {bookingPayload && (
        <EventBookingModal
          locale={locale}
          paymentModalContent={bookingModalContent.paymentModal}
          bookingPayload={bookingPayload}
          analyticsSectionId='consultations-booking'
          metaPixelContentName={PIXEL_CONTENT_NAME.consultation_booking}
          captchaWidgetAction='consultation_reservation_submit'
          onClose={() => {
            setIsBookingModalOpen(false);
          }}
          onSubmitReservation={(summary) => {
            setIsBookingModalOpen(false);
            setThankYouSummary(summary);
            setIsThankYouOpen(true);
          }}
        />
      )}

      {isThankYouOpen && (
        <BookingThankYouModal
          locale={locale}
          content={bookingModalContent.thankYouModal}
          summary={thankYouSummary}
          analyticsSectionId='consultations-booking'
          whatsappHref={thankYouWhatsappHref}
          whatsappCtaLabel={thankYouWhatsappCtaLabel}
          onClose={() => {
            setIsThankYouOpen(false);
          }}
        />
      )}
    </>
  );
}
