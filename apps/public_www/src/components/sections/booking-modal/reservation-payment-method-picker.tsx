'use client';

import Image from 'next/image';
import dynamic from 'next/dynamic';
import type { RefObject } from 'react';

import { FpsQrCode } from '@/components/sections/booking-modal/shared';
import {
  BANK_ICON_SOURCE,
  FPS_ICON_SOURCE,
  PAYMENT_METHOD_BANK_TRANSFER,
  PAYMENT_METHOD_FPS,
  PAYMENT_METHOD_STRIPE,
  STRIPE_CARD_ICON_SOURCE,
  type PaymentMethodFlags,
  type PaymentMethodOption,
} from '@/components/sections/booking-modal/reservation-form-types';
import { getBankTransferDetails } from '@/components/sections/booking-modal/reservation-payment-helpers';
import type { StripePaymentFieldsHandle } from '@/components/sections/booking-modal/stripe-payment-section';
import type { StripeElementsOptions } from '@stripe/stripe-js';
import type { BookingPaymentModalContent } from '@/content';
import { trackAnalyticsEvent, trackEcommerceEvent } from '@/lib/analytics';

const StripePaymentSection = dynamic(
  () =>
    import('@/components/sections/booking-modal/stripe-payment-section').then(
      (module) => module.StripePaymentSection,
    ),
  { ssr: false },
);

interface ReservationPaymentMethodPickerProps {
  analyticsSectionId: string;
  content: BookingPaymentModalContent;
  eventTitle: string;
  fpsQrImageDataUrl: string;
  isStripeReady: boolean;
  isStripeUnavailable: boolean;
  markFormInteracted: () => void;
  onFpsQrImageDataUrlChange: (dataUrl: string) => void;
  paymentMethodFlags: PaymentMethodFlags;
  selectedPaymentMethod: PaymentMethodOption;
  selectedServiceTierLabel: string;
  setSelectedPaymentMethod: (method: PaymentMethodOption) => void;
  showPaymentMethodPickers: boolean;
  stripeElementsOptions: StripeElementsOptions | null;
  stripePaymentFieldsRef: RefObject<StripePaymentFieldsHandle | null>;
  stripePaymentIntentId?: string;
  totalAmount: number;
}

export function ReservationPaymentMethodPicker({
  analyticsSectionId,
  content,
  eventTitle,
  fpsQrImageDataUrl,
  isStripeReady,
  isStripeUnavailable,
  markFormInteracted,
  onFpsQrImageDataUrlChange,
  paymentMethodFlags,
  selectedPaymentMethod,
  selectedServiceTierLabel,
  setSelectedPaymentMethod,
  showPaymentMethodPickers,
  stripeElementsOptions,
  stripePaymentFieldsRef,
  stripePaymentIntentId,
  totalAmount,
}: ReservationPaymentMethodPickerProps) {
  function trackPaymentMethodSelected(method: PaymentMethodOption) {
    trackAnalyticsEvent('booking_payment_method_selected', {
      sectionId: analyticsSectionId,
      ctaLocation: 'payment_method',
      params: {
        payment_method: method,
      },
    });
    trackEcommerceEvent('add_payment_info', {
      value: totalAmount,
      paymentType: method,
      items: [{
        item_id: `mba-${selectedServiceTierLabel}`,
        item_name: eventTitle,
        item_category: selectedServiceTierLabel,
        price: totalAmount,
        quantity: 1,
      }],
    });
  }

  return (
    <div data-booking-payment='true' className='w-full space-y-2 py-1'>
      <p className='text-sm font-semibold es-text-heading'>
        {content.paymentMethodLabel}
      </p>
      <div
        data-booking-payment-options='true'
        className='flex min-h-[244px] flex-col rounded-[14px] border es-border-input es-bg-surface-white p-[10px]'
      >
        <p
          data-booking-payment-confirmation-note='true'
          className='pb-2 text-sm leading-[1.45] es-text-heading'
        >
          {content.paymentConfirmationNote}
        </p>
        <div
          data-booking-payment-options-columns='true'
          className={`grid min-h-0 flex-1 gap-3 ${
            showPaymentMethodPickers ? 'grid-cols-5' : 'grid-cols-1'
          }`}
        >
          {showPaymentMethodPickers ? (
            <div
              data-booking-payment-options-column-left='true'
              className='col-span-1'
            >
              <div className='flex h-full flex-col justify-start gap-2 pt-1'>
                {paymentMethodFlags.fpsQr ? (
                  <label
                    className={`es-focus-ring flex h-[53px] w-full cursor-pointer items-center justify-center rounded-lg border p-2 ${
                      selectedPaymentMethod === PAYMENT_METHOD_FPS
                        ? 'border-black/20 es-bg-surface-muted'
                        : 'border-transparent'
                    }`}
                  >
                    <input
                      type='radio'
                      name='booking-payment-method'
                      value={PAYMENT_METHOD_FPS}
                      checked={selectedPaymentMethod === PAYMENT_METHOD_FPS}
                      onChange={() => {
                        markFormInteracted();
                        setSelectedPaymentMethod(PAYMENT_METHOD_FPS);
                        trackPaymentMethodSelected(PAYMENT_METHOD_FPS);
                      }}
                      className='sr-only'
                    />
                    <span className='sr-only'>{content.paymentMethodValue}</span>
                    <Image
                      src={FPS_ICON_SOURCE}
                      alt=''
                      data-booking-fps-icon='true'
                      aria-hidden='true'
                      width={32}
                      height={18}
                      className='h-[36px] w-auto shrink-0'
                    />
                  </label>
                ) : null}
                {paymentMethodFlags.bankTransfer ? (
                  <label
                    className={`es-focus-ring flex h-[53px] w-full cursor-pointer items-center justify-center rounded-lg border p-2 ${
                      selectedPaymentMethod === PAYMENT_METHOD_BANK_TRANSFER
                        ? 'border-black/20 es-bg-surface-muted'
                        : 'border-transparent'
                    }`}
                  >
                    <input
                      type='radio'
                      name='booking-payment-method'
                      value={PAYMENT_METHOD_BANK_TRANSFER}
                      checked={selectedPaymentMethod === PAYMENT_METHOD_BANK_TRANSFER}
                      onChange={() => {
                        markFormInteracted();
                        setSelectedPaymentMethod(PAYMENT_METHOD_BANK_TRANSFER);
                        trackPaymentMethodSelected(PAYMENT_METHOD_BANK_TRANSFER);
                      }}
                      className='sr-only'
                    />
                    <span className='sr-only'>
                      {content.paymentMethodBankTransferValue}
                    </span>
                    <Image
                      src={BANK_ICON_SOURCE}
                      alt=''
                      data-booking-bank-icon='true'
                      aria-hidden='true'
                      width={20}
                      height={20}
                      className='h-6 w-6 shrink-0'
                    />
                  </label>
                ) : null}
                {paymentMethodFlags.stripeCards ? (
                  <label
                    className={`es-focus-ring flex h-[53px] w-full cursor-pointer items-center justify-center rounded-lg border p-2 ${
                      selectedPaymentMethod === PAYMENT_METHOD_STRIPE
                        ? 'border-black/20 es-bg-surface-muted'
                        : 'border-transparent'
                    }`}
                  >
                    <input
                      type='radio'
                      name='booking-payment-method'
                      value={PAYMENT_METHOD_STRIPE}
                      checked={selectedPaymentMethod === PAYMENT_METHOD_STRIPE}
                      onChange={() => {
                        markFormInteracted();
                        setSelectedPaymentMethod(PAYMENT_METHOD_STRIPE);
                        trackPaymentMethodSelected(PAYMENT_METHOD_STRIPE);
                      }}
                      className='sr-only'
                    />
                    <span className='sr-only'>
                      {content.paymentMethodStripeValue}
                    </span>
                    <Image
                      src={STRIPE_CARD_ICON_SOURCE}
                      alt=''
                      data-booking-stripe-icon='true'
                      aria-hidden='true'
                      width={24}
                      height={24}
                      className='h-6 w-6 shrink-0'
                    />
                  </label>
                ) : null}
              </div>
            </div>
          ) : null}
          <div
            data-booking-payment-options-column-right='true'
            className={`flex h-full items-center ${
              showPaymentMethodPickers ? 'col-span-4' : 'col-span-1'
            }`}
          >
            {selectedPaymentMethod === PAYMENT_METHOD_FPS ? (
              <div
                data-booking-payment-details='fps'
                className='flex h-full w-full flex-col items-center justify-center gap-2'
              >
                <FpsQrCode
                  amount={totalAmount}
                  label={content.fpsQrCodeLabel}
                  onDataUrlChange={onFpsQrImageDataUrlChange}
                />
                <p
                  data-booking-payment-fps-copy='true'
                  className='text-center text-sm leading-[1.45] es-text-heading'
                >
                  {content.paymentFpsQrInstruction}
                </p>
              </div>
            ) : selectedPaymentMethod === PAYMENT_METHOD_BANK_TRANSFER ? (
              <div
                data-booking-payment-details='bank-transfer'
                className='flex h-full w-full flex-col items-center justify-center'
              >
                <dl className='space-y-2 text-center'>
                  {getBankTransferDetails(content).map((bankDetail, bankDetailIndex) => (
                    <div key={bankDetail.label} className='flex flex-col items-center space-y-0.5'>
                      <dt
                        className={`text-xs font-semibold uppercase tracking-wide es-text-heading ${
                          bankDetailIndex > 0 ? 'pt-[10px]' : ''
                        }`}
                      >
                        {bankDetail.label}
                      </dt>
                      <dd className='text-sm font-semibold es-text-heading'>
                        {bankDetail.value}
                      </dd>
                    </div>
                  ))}
                </dl>
              </div>
            ) : (
              <div
                data-booking-payment-details='stripe'
                className='w-full'
              >
                {isStripeUnavailable ? (
                  <p className='text-sm font-semibold es-text-danger-strong'>
                    {content.paymentMethodStripeUnavailableLabel}
                  </p>
                ) : isStripeReady && stripeElementsOptions && stripePaymentIntentId ? (
                  <StripePaymentSection
                    fieldsRef={stripePaymentFieldsRef}
                    paymentIntentId={stripePaymentIntentId}
                    stripeElementsOptions={stripeElementsOptions}
                    fallbackErrorMessage={content.submitErrorMessage}
                  />
                ) : (
                  <p className='text-sm es-text-heading'>
                    {content.paymentMethodStripeLoadingLabel}
                  </p>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
