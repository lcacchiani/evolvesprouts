'use client';

import type { CSSProperties } from 'react';
import { useMemo, useState } from 'react';

import {
  MyBestAuntieBookingModal,
  MyBestAuntieThankYouModal,
  type ReservationSummary,
} from '@/components/sections/my-best-auntie-booking-modal';
import { SectionEyebrowChip } from '@/components/section-eyebrow-chip';
import { SectionShell } from '@/components/section-shell';
import type { Locale, MyBestAuntieBookingContent } from '@/content';

interface MyBestAuntieBookingProps {
  locale: Locale;
  content: MyBestAuntieBookingContent;
}

const SECTION_BACKGROUND = '#FFFFFF';
const HEADING_TEXT_COLOR =
  'var(--figma-colors-join-our-sprouts-squad-community, #333333)';
const BODY_TEXT_COLOR = 'var(--figma-colors-home, #4A4A4A)';

const eyebrowStyle: CSSProperties = {
  color: HEADING_TEXT_COLOR,
  fontFamily: 'var(--figma-fontfamilies-lato, Lato), sans-serif',
  fontSize: '18px',
  fontWeight: 500,
  lineHeight: 1,
};

const headingStyle: CSSProperties = {
  color: HEADING_TEXT_COLOR,
  fontFamily: 'var(--figma-fontfamilies-poppins, Poppins), sans-serif',
  fontWeight: 700,
  lineHeight: 1.15,
};

const bodyStyle: CSSProperties = {
  color: BODY_TEXT_COLOR,
  fontFamily: 'var(--figma-fontfamilies-lato, Lato), sans-serif',
  fontWeight: 400,
  lineHeight: 1.55,
};

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('en-HK', {
    style: 'currency',
    currency: 'HKD',
    maximumFractionDigits: 0,
  }).format(value);
}

export function MyBestAuntieBooking({
  locale,
  content,
}: MyBestAuntieBookingProps) {
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [isThankYouModalOpen, setIsThankYouModalOpen] = useState(false);
  const [reservationSummary, setReservationSummary] =
    useState<ReservationSummary | null>(null);

  const lowestPackagePrice = useMemo(() => {
    const prices = content.paymentModal.packageOptions.map((item) => item.price);
    if (prices.length === 0) {
      return 0;
    }
    return Math.min(...prices);
  }, [content.paymentModal.packageOptions]);

  return (
    <>
      <SectionShell
        id='my-best-auntie-booking'
        ariaLabel={content.title}
        dataFigmaNode='book_spot_Sec'
        style={{ backgroundColor: SECTION_BACKGROUND }}
      >
        <div className='mx-auto w-full max-w-[1465px]'>
          <div className='grid gap-7 rounded-[30px] border border-[#EED5C1] bg-[#FFF8F2] p-5 sm:p-7 lg:grid-cols-[1fr_420px] lg:gap-8 lg:p-9'>
            <section className='space-y-5'>
              <SectionEyebrowChip
                label={content.eyebrow}
                labelStyle={eyebrowStyle}
                className='px-4 py-2.5 sm:px-5'
                style={{ borderColor: '#EECAB0', backgroundColor: '#FFFFFF' }}
              />
              <h1
                className='text-[clamp(2rem,5.6vw,3.3rem)]'
                style={headingStyle}
              >
                {content.title}
              </h1>
              <p className='max-w-[58ch] text-[clamp(1rem,2vw,1.2rem)]' style={bodyStyle}>
                {content.description}
              </p>

              <div className='rounded-2xl border border-[#EECAB0] bg-white px-5 py-4 sm:px-6'>
                <p className='text-sm font-semibold text-[#5A5A5A]'>
                  {content.scheduleLabel}
                </p>
                <p className='mt-2 text-[clamp(1.2rem,2.6vw,1.8rem)] font-semibold text-[#333333]'>
                  {content.scheduleDate}
                </p>
                <p className='mt-1 text-[#4A4A4A]'>{content.scheduleTime}</p>
                <p className='mt-3 inline-flex rounded-full bg-[#FFF1E6] px-3 py-1 text-sm font-semibold text-[#C84A16]'>
                  {content.availabilityLabel}
                </p>
              </div>
            </section>

            <aside className='rounded-2xl border border-[#EECAB0] bg-white p-5 sm:p-6'>
              <ul className='space-y-4'>
                <li className='rounded-xl border border-[#EECAB0] bg-[#FFF9F4] px-4 py-3'>
                  <h2 className='text-base font-semibold text-[#333333]'>
                    {content.summary.pricingTitle}
                  </h2>
                  <p className='mt-2 text-sm text-[#5A5A5A]'>
                    {content.summary.startingFromLabel}
                  </p>
                  <p className='text-[1.6rem] font-semibold text-[#333333]'>
                    {formatCurrency(lowestPackagePrice)}
                  </p>
                  <p className='mt-1 text-xs text-[#666463]'>
                    {content.summary.refundHint}
                  </p>
                </li>

                <li className='rounded-xl border border-[#EECAB0] bg-[#FFF9F4] px-4 py-3'>
                  <h2 className='text-base font-semibold text-[#333333]'>
                    {content.summary.locationTitle}
                  </h2>
                  <p className='mt-2 font-semibold text-[#333333]'>
                    {content.summary.locationName}
                  </p>
                  <p className='mt-1 text-sm text-[#4A4A4A]'>
                    {content.summary.locationAddress}
                  </p>
                  <a
                    href={content.summary.directionHref}
                    target='_blank'
                    rel='noopener noreferrer'
                    className='mt-2 inline-flex text-sm font-semibold text-[#C84A16] underline underline-offset-2'
                  >
                    {content.summary.directionLabel}
                  </a>
                </li>

                <li className='rounded-xl border border-[#EECAB0] bg-[#FFF9F4] px-4 py-3'>
                  <h2 className='text-base font-semibold text-[#333333]'>
                    {content.summary.reservationTitle}
                  </h2>
                  <p className='mt-2 text-sm text-[#4A4A4A]'>
                    {content.summary.reservationDescription}
                  </p>
                </li>
              </ul>

              <button
                type='button'
                onClick={() => {
                  setIsPaymentModalOpen(true);
                }}
                className='es-focus-ring es-cta-button es-cta-primary mt-5 h-[58px] w-full rounded-[10px] px-5 text-base font-semibold'
              >
                {content.confirmAndPayLabel}
              </button>

              <a
                href={content.learnMoreHref}
                className='es-focus-ring mt-3 inline-flex h-11 w-full items-center justify-center rounded-[10px] border border-[#C84A16] bg-white px-4 text-sm font-semibold text-[#C84A16]'
              >
                {content.learnMoreLabel}
              </a>
            </aside>
          </div>
        </div>
      </SectionShell>

      <MyBestAuntieBookingModal
        content={content.paymentModal}
        isOpen={isPaymentModalOpen}
        onClose={() => {
          setIsPaymentModalOpen(false);
        }}
        onSubmitReservation={(summary) => {
          setReservationSummary(summary);
          setIsPaymentModalOpen(false);
          setIsThankYouModalOpen(true);
        }}
      />

      <MyBestAuntieThankYouModal
        locale={locale}
        content={content.thankYouModal}
        isOpen={isThankYouModalOpen}
        summary={reservationSummary}
        homeHref={`/${locale}`}
        onClose={() => {
          setIsThankYouModalOpen(false);
        }}
      />
    </>
  );
}
