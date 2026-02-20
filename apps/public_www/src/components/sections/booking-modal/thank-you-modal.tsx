'use client';

import Image from 'next/image';
import { useId, useRef } from 'react';

import { ButtonPrimitive } from '@/components/shared/button-primitive';
import {
  OverlayDialogPanel,
  OverlayScrollableBody,
} from '@/components/shared/overlay-surface';
import type { ReservationSummary } from '@/components/sections/my-best-auntie-booking-modal';
import {
  CloseButton,
  ModalOverlay,
} from '@/components/sections/booking-modal/shared';
import type { Locale, MyBestAuntieBookingContent } from '@/content';
import {
  resolveLocalizedDate,
} from '@/components/sections/booking-modal/helpers';
import { formatCurrencyHkd } from '@/lib/format';
import { useModalLockBody } from '@/lib/hooks/use-modal-lock-body';
import { useModalFocusManagement } from '@/lib/hooks/use-modal-focus-management';

export interface MyBestAuntieThankYouModalProps {
  locale: Locale;
  content: MyBestAuntieBookingContent['thankYouModal'];
  summary: ReservationSummary | null;
  homeHref: string;
  onClose: () => void;
}

const PRINT_WINDOW_FEATURES = 'noopener,noreferrer,width=880,height=700';

function appendPrintSummaryRow({
  popupDocument,
  container,
  label,
  value,
}: {
  popupDocument: Document;
  container: HTMLElement;
  label: string;
  value: string;
}): void {
  const row = popupDocument.createElement('div');
  row.className = 'row';

  const labelElement = popupDocument.createElement('span');
  labelElement.textContent = label;

  const valueElement = popupDocument.createElement('strong');
  valueElement.textContent = value;

  row.append(labelElement, valueElement);
  container.append(row);
}

function renderPrintDocument({
  popupDocument,
  locale,
  successLabel,
  title,
  transactionDateLabel,
  transactionDate,
  paymentMethodLabel,
  paymentMethod,
  totalLabel,
  totalAmountLabel,
}: {
  popupDocument: Document;
  locale: Locale;
  successLabel: string;
  title: string;
  transactionDateLabel: string;
  transactionDate: string;
  paymentMethodLabel: string;
  paymentMethod: string;
  totalLabel: string;
  totalAmountLabel: string;
}): void {
  popupDocument.title = successLabel;
  popupDocument.documentElement.lang = locale;
  popupDocument.head.replaceChildren();
  popupDocument.body.replaceChildren();

  const metaCharset = popupDocument.createElement('meta');
  metaCharset.setAttribute('charset', 'utf-8');

  const styleElement = popupDocument.createElement('style');
  styleElement.textContent =
    'body { font-family: "Poppins", sans-serif; margin: 24px; color: #333; }' +
    'h1 { margin: 0 0 8px; }' +
    '.card { border: 1px solid #ddd; border-radius: 12px; padding: 16px; }' +
    '.row { display: flex; justify-content: space-between; margin: 8px 0; }';
  popupDocument.head.append(metaCharset, styleElement);

  const heading = popupDocument.createElement('h1');
  heading.textContent = successLabel;

  const subtitle = popupDocument.createElement('p');
  subtitle.textContent = title;

  const card = popupDocument.createElement('div');
  card.className = 'card';

  appendPrintSummaryRow({
    popupDocument,
    container: card,
    label: transactionDateLabel,
    value: transactionDate,
  });
  appendPrintSummaryRow({
    popupDocument,
    container: card,
    label: paymentMethodLabel,
    value: paymentMethod,
  });
  appendPrintSummaryRow({
    popupDocument,
    container: card,
    label: totalLabel,
    value: totalAmountLabel,
  });

  popupDocument.body.append(heading, subtitle, card);
}

export function MyBestAuntieThankYouModal({
  locale,
  content,
  summary,
  homeHref,
  onClose,
}: MyBestAuntieThankYouModalProps) {
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

  const transactionDate = resolveLocalizedDate(locale);

  function handlePrint() {
    if (!summary) {
      return;
    }

    const popup = window.open('', '_blank', PRINT_WINDOW_FEATURES);
    if (!popup) {
      window.print();
      return;
    }
    renderPrintDocument({
      popupDocument: popup.document,
      locale,
      successLabel: content.successLabel,
      title: content.title,
      transactionDateLabel: content.transactionDateLabel,
      transactionDate,
      paymentMethodLabel: content.paymentMethodLabel,
      paymentMethod: summary.paymentMethod,
      totalLabel: content.totalLabel,
      totalAmountLabel: formatCurrencyHkd(summary.totalAmount),
    });
    popup.focus();
    popup.print();
    popup.close();
  }

  return (
    <ModalOverlay onClose={onClose}>
      <OverlayDialogPanel
        panelRef={modalPanelRef}
        ariaLabelledBy={dialogTitleId}
        ariaDescribedBy={dialogDescriptionId}
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
            <h3 className='mt-3 text-[22px] font-normal leading-none es-text-heading sm:text-[28px]'>
              {content.successLabel}
            </h3>
            <h2
              id={dialogTitleId}
              className='es-type-title mt-2 max-w-[610px] leading-[1.1] es-my-best-auntie-thank-you-heading'
            >
              {content.title}
            </h2>
            <p
              id={dialogDescriptionId}
              className='mt-3 text-lg leading-7 es-my-best-auntie-thank-you-body'
            >
              {content.subtitle}
              <br />
              <span className='font-semibold es-text-emphasis'>
                {summary?.attendeeEmail ?? content.noEmailFallback}
              </span>
            </p>
          </div>

          <section className='relative z-10 mx-auto mt-10 max-w-[950px] overflow-hidden rounded-2xl border es-border-panel es-bg-surface-muted px-4 py-7 shadow-[0_9px_9px_rgba(49,86,153,0.08),0_9px_18px_rgba(49,86,153,0.06)] sm:px-8 sm:py-10'>
            <Image
              src='/images/evolvesprouts-logo.svg'
              alt=''
              width={319}
              height={359}
              className='pointer-events-none absolute -right-3 -top-6 hidden w-[250px] lg:block'
              aria-hidden='true'
            />

            <div className='relative z-10 border-b es-divider-blue pb-8'>
              <div className='flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between'>
                <div>
                  <h4 className='text-xl font-semibold leading-none es-text-heading sm:text-2xl'>
                    {summary?.courseLabel ?? content.courseLabel}
                  </h4>
                  <div className='mt-4 flex flex-wrap gap-2'>
                    <span className='inline-flex items-center gap-1 rounded-full bg-white px-4 py-2 text-sm font-medium es-text-muted'>
                      <span
                        className='h-6 w-6 shrink-0 es-mask-calendar-heading'
                        aria-hidden='true'
                      />
                      {summary?.scheduleDateLabel ?? summary?.monthLabel ?? ''}
                    </span>
                    <span className='inline-flex items-center gap-1 rounded-full bg-white px-4 py-2 text-sm font-medium es-text-muted'>
                      <Image
                        src='/images/clock.svg'
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
                  <span className='text-sm font-medium leading-none es-text-muted'>
                    {summary?.packageLabel ?? ''}
                  </span>
                  <p className='mt-2 text-2xl font-bold leading-none es-text-heading sm:text-[30px]'>
                    {formatCurrencyHkd(summary?.totalAmount ?? 0)}
                  </p>
                </div>
              </div>
            </div>

            <dl className='relative z-10 space-y-7 border-b es-divider-blue py-8'>
              <div className='flex items-center justify-between gap-4'>
                <dt className='text-lg font-medium es-text-subtle sm:text-[22px]'>
                  {content.transactionDateLabel}
                </dt>
                <dd className='text-2xl font-bold leading-none es-text-heading sm:text-[30px]'>
                  {transactionDate}
                </dd>
              </div>
              <div className='flex items-center justify-between gap-4'>
                <dt className='text-lg font-medium es-text-subtle sm:text-[22px]'>
                  {content.paymentMethodLabel}
                </dt>
                <dd className='text-2xl font-bold leading-none es-text-heading sm:text-[30px]'>
                  {summary?.paymentMethod ?? ''}
                </dd>
              </div>
              <div className='flex items-center justify-between gap-4'>
                <dt className='text-lg font-medium es-text-subtle sm:text-[22px]'>
                  {content.totalLabel}
                </dt>
                <dd className='text-2xl font-bold leading-none es-text-heading sm:text-[30px]'>
                  {formatCurrencyHkd(summary?.totalAmount ?? 0)}
                </dd>
              </div>
            </dl>

            <div className='relative z-10 pt-7'>
              <div className='flex flex-wrap justify-end gap-3'>
                <ButtonPrimitive
                  variant='outline'
                  onClick={handlePrint}
                  className='h-[54px] gap-2 rounded-control px-6 text-[16px] font-semibold sm:h-[60px] sm:px-8 sm:text-[18px]'
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
                </ButtonPrimitive>
                <ButtonPrimitive
                  href={homeHref}
                  variant='primary'
                >
                  {content.backHomeLabel}
                </ButtonPrimitive>
              </div>
            </div>
          </section>
        </OverlayScrollableBody>
      </OverlayDialogPanel>
    </ModalOverlay>
  );
}
