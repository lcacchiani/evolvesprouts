'use client';

import Image from 'next/image';
import Link from 'next/link';
import type { CSSProperties } from 'react';

import type { ReservationSummary } from '@/components/sections/my-best-auntie-booking-modal';
import {
  bodyTextStyle,
  headingTextStyle,
} from '@/lib/design-tokens';
import {
  CloseButton,
  MODAL_PANEL_BACKGROUND,
  ModalOverlay,
} from '@/components/sections/booking-modal/shared';
import type { Locale, MyBestAuntieBookingContent } from '@/content';
import {
  createMaskIconStyle,
  escapeHtml,
  resolveLocalizedDate,
} from '@/components/sections/booking-modal/helpers';
import { formatCurrencyHkd } from '@/lib/format';
import { useModalLockBody } from '@/lib/hooks/use-modal-lock-body';

export interface MyBestAuntieThankYouModalProps {
  locale: Locale;
  content: MyBestAuntieBookingContent['thankYouModal'];
  summary: ReservationSummary | null;
  homeHref: string;
  onClose: () => void;
}

const CALENDAR_ICON_MASK_PATH = '/images/calendar.svg';

const headingStyle: CSSProperties = headingTextStyle({
  lineHeight: 1.2,
});

const bodyStyle: CSSProperties = bodyTextStyle({
  lineHeight: 1.5,
});

const darkCalendarIconMaskStyle = createMaskIconStyle(
  CALENDAR_ICON_MASK_PATH,
  '#333333',
);

export function MyBestAuntieThankYouModal({
  locale,
  content,
  summary,
  homeHref,
  onClose,
}: MyBestAuntieThankYouModalProps) {
  useModalLockBody({ onEscape: onClose });

  const transactionDate = resolveLocalizedDate(locale);

  function handlePrint() {
    if (!summary) {
      return;
    }

    const popup = window.open('', '_blank', 'width=880,height=700');
    if (!popup) {
      window.print();
      return;
    }

    const printHtml = `
      <html>
        <head>
          <title>${escapeHtml(content.successLabel)}</title>
          <style>
            body { font-family: Arial, sans-serif; margin: 24px; color: #333; }
            h1 { margin: 0 0 8px; }
            .card { border: 1px solid #ddd; border-radius: 12px; padding: 16px; }
            .row { display: flex; justify-content: space-between; margin: 8px 0; }
          </style>
        </head>
        <body>
          <h1>${escapeHtml(content.successLabel)}</h1>
          <p>${escapeHtml(content.title)}</p>
          <div class="card">
            <div class="row">
              <span>${escapeHtml(content.transactionDateLabel)}</span>
              <strong>${escapeHtml(transactionDate)}</strong>
            </div>
            <div class="row">
              <span>${escapeHtml(content.paymentMethodLabel)}</span>
              <strong>${escapeHtml(summary.paymentMethod)}</strong>
            </div>
            <div class="row">
              <span>${escapeHtml(content.totalLabel)}</span>
              <strong>${escapeHtml(formatCurrencyHkd(summary.totalAmount))}</strong>
            </div>
          </div>
        </body>
      </html>
    `;

    popup.document.open();
    popup.document.write(printHtml);
    popup.document.close();
    popup.focus();
    popup.print();
    popup.close();
  }

  return (
    <ModalOverlay onClose={onClose}>
      <section
        role='dialog'
        aria-modal='true'
        aria-label={content.title}
        className='relative w-full max-w-[1190px] overflow-hidden rounded-[24px] border border-black/10 shadow-[0_22px_70px_rgba(0,0,0,0.42)]'
        style={{ backgroundColor: MODAL_PANEL_BACKGROUND }}
      >
        <header className='flex justify-end px-4 pb-6 pt-6 sm:px-8 sm:pt-7'>
          <CloseButton label={content.closeLabel} onClose={onClose} />
        </header>

        <div className='relative max-h-[82vh] overflow-y-auto px-4 pb-6 sm:px-8 sm:pb-8'>
          <Image
            src='/images/evolvesprouts-logo.svg'
            alt=''
            width={1488}
            height={855}
            className='pointer-events-none absolute left-1/2 top-0 hidden w-[800px] -translate-x-1/2 -translate-y-[120px] lg:block'
            aria-hidden='true'
          />
          <Image
            src='/images/evolvesprouts-logo.svg'
            alt=''
            width={1196}
            height={568}
            className='pointer-events-none absolute left-1/2 top-0 hidden w-[650px] -translate-x-1/2 -translate-y-10 lg:block'
            aria-hidden='true'
          />

          <div className='relative z-10 flex flex-col items-center pt-0 text-center sm:pt-6 lg:pt-14'>
            <div className='flex h-[100px] w-[100px] items-center justify-center rounded-full bg-[#D5E9CB]'>
              <Image
                src='/images/my-best-auntie-booking/green-tick-icon.png'
                alt=''
                width={124}
                height={124}
                className='h-[55px] w-[55px]'
                aria-hidden='true'
              />
            </div>
            <h3 className='mt-3 text-[22px] font-normal leading-none text-[#333333] sm:text-[28px]'>
              {content.successLabel}
            </h3>
            <h2
              className='mt-2 max-w-[610px] text-[clamp(1.5rem,4vw,2.5rem)] leading-[1.1]'
              style={headingStyle}
            >
              {content.title}
            </h2>
            <p className='mt-3 text-[18px] leading-7 text-[#4A4A4A]' style={bodyStyle}>
              {content.subtitle}
              <br />
              <span className='font-semibold text-[#2C2C2C]'>
                {summary?.attendeeEmail ?? content.noEmailFallback}
              </span>
            </p>
          </div>

          <section className='relative z-10 mx-auto mt-10 max-w-[950px] overflow-hidden rounded-[16px] border border-[#D0E4F4] bg-[#F8F8F8] px-4 py-7 shadow-[0_9px_9px_rgba(49,86,153,0.08),0_9px_18px_rgba(49,86,153,0.06)] sm:px-8 sm:py-10'>
            <Image
              src='/images/evolvesprouts-logo.svg'
              alt=''
              width={319}
              height={359}
              className='pointer-events-none absolute -right-3 -top-6 hidden w-[250px] lg:block'
              aria-hidden='true'
            />

            <div className='relative z-10 border-b border-[#418CCF3D] pb-8'>
              <div className='flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between'>
                <div>
                  <h4 className='text-[20px] font-semibold leading-none text-[#333333] sm:text-[24px]'>
                    {summary?.courseLabel ?? content.courseLabel}
                  </h4>
                  <div className='mt-4 flex flex-wrap gap-2'>
                    <span className='inline-flex items-center gap-1 rounded-[50px] bg-white px-4 py-2 text-sm font-medium text-[#5B617F]'>
                      <span
                        className='h-6 w-6 shrink-0'
                        style={darkCalendarIconMaskStyle}
                        aria-hidden='true'
                      />
                      {summary?.scheduleDateLabel ?? summary?.monthLabel ?? ''}
                    </span>
                    <span className='inline-flex items-center gap-1 rounded-[50px] bg-white px-4 py-2 text-sm font-medium text-[#5B617F]'>
                      <Image
                        src='/images/my-best-auntie-booking/clock.png'
                        alt=''
                        width={24}
                        height={24}
                        aria-hidden='true'
                      />
                      {summary?.scheduleTimeLabel ?? ''}
                    </span>
                  </div>
                </div>
                <div className='text-left sm:text-right'>
                  <span className='text-sm font-medium leading-none text-[#5B617F]'>
                    {summary?.packageLabel ?? ''}
                  </span>
                  <p className='mt-2 text-[24px] font-bold leading-none text-[#333333] sm:text-[30px]'>
                    {formatCurrencyHkd(summary?.totalAmount ?? 0)}
                  </p>
                </div>
              </div>
            </div>

            <dl className='relative z-10 space-y-7 border-b border-[#418CCF3D] py-8'>
              <div className='flex items-center justify-between gap-4'>
                <dt className='text-[18px] font-medium text-[#828B9E] sm:text-[22px]'>
                  {content.transactionDateLabel}
                </dt>
                <dd className='text-[24px] font-bold leading-none text-[#333333] sm:text-[30px]'>
                  {transactionDate}
                </dd>
              </div>
              <div className='flex items-center justify-between gap-4'>
                <dt className='text-[18px] font-medium text-[#828B9E] sm:text-[22px]'>
                  {content.paymentMethodLabel}
                </dt>
                <dd className='text-[24px] font-bold leading-none text-[#333333] sm:text-[30px]'>
                  {summary?.paymentMethod ?? ''}
                </dd>
              </div>
              <div className='flex items-center justify-between gap-4'>
                <dt className='text-[18px] font-medium text-[#828B9E] sm:text-[22px]'>
                  {content.totalLabel}
                </dt>
                <dd className='text-[24px] font-bold leading-none text-[#333333] sm:text-[30px]'>
                  {formatCurrencyHkd(summary?.totalAmount ?? 0)}
                </dd>
              </div>
            </dl>

            <div className='relative z-10 pt-7'>
              <div className='flex flex-wrap justify-end gap-3'>
                <button
                  type='button'
                  onClick={handlePrint}
                  className='es-focus-ring inline-flex h-[54px] items-center gap-2 rounded-[10px] border border-[#ED622E] bg-white px-6 text-[16px] font-semibold text-[#ED622E] sm:h-[60px] sm:px-8 sm:text-[18px]'
                >
                  <svg
                    width='24'
                    height='24'
                    viewBox='0 0 24 24'
                    fill='none'
                    xmlns='http://www.w3.org/2000/svg'
                    aria-hidden='true'
                  >
                    <path
                      d='M16 8V5H8V8H6V3H18V8H16ZM18 12.5C18.2833 12.5 18.5208 12.4042 18.7125 12.2125C18.9042 12.0208 19 11.7833 19 11.5C19 11.2167 18.9042 10.9792 18.7125 10.7875C18.5208 10.5958 18.2833 10.5 18 10.5C17.7167 10.5 17.4792 10.5958 17.2875 10.7875C17.0958 10.9792 17 11.2167 17 11.5C17 11.7833 17.0958 12.0208 17.2875 12.2125C17.4792 12.4042 17.7167 12.5 18 12.5ZM16 19V15H8V19H16ZM18 21H6V17H2V11C2 10.15 2.29167 9.4375 2.875 8.8625C3.45833 8.2875 4.16667 8 5 8H19C19.85 8 20.5625 8.2875 21.1375 8.8625C21.7125 9.4375 22 10.15 22 11V17H18V21ZM20 15V11C20 10.7167 19.9042 10.4792 19.7125 10.2875C19.5208 10.0958 19.2833 10 19 10H5C4.71667 10 4.47917 10.0958 4.2875 10.2875C4.09583 10.4792 4 10.7167 4 11V15H6V13H18V15H20Z'
                      fill='currentColor'
                    />
                  </svg>
                  {content.printLabel}
                </button>
                <Link
                  href={homeHref}
                  className='es-focus-ring es-cta-button es-cta-primary inline-flex h-[54px] items-center justify-center rounded-[10px] px-6 text-[16px] font-semibold sm:h-[60px] sm:px-8 sm:text-[18px]'
                >
                  {content.backHomeLabel}
                </Link>
              </div>
            </div>
          </section>
        </div>
      </section>
    </ModalOverlay>
  );
}
