import { SmartLink } from '@/components/shared/smart-link';
import { ACKNOWLEDGEMENT_ERROR_MESSAGE_ID } from '@/components/sections/booking-modal/reservation-form-types';
import type { BookingPaymentModalContent } from '@/content';

interface ReservationAcknowledgementsProps {
  content: BookingPaymentModalContent;
  hasAcknowledgementsError: boolean;
  hasPendingReservationAcknowledgement: boolean;
  hasTermsAgreement: boolean;
  isFreeReservation: boolean;
  marketingOptIn: boolean;
  markFormInteracted: () => void;
  onMarketingOptInChange: (checked: boolean) => void;
  onPendingReservationAcknowledgementChange: (checked: boolean) => void;
  onTermsAgreementChange: (checked: boolean) => void;
}

export function ReservationAcknowledgements({
  content,
  hasAcknowledgementsError,
  hasPendingReservationAcknowledgement,
  hasTermsAgreement,
  isFreeReservation,
  marketingOptIn,
  markFormInteracted,
  onMarketingOptInChange,
  onPendingReservationAcknowledgementChange,
  onTermsAgreementChange,
}: ReservationAcknowledgementsProps) {
  return (
    <div data-booking-acknowledgements='true' className='space-y-2'>
      {!isFreeReservation ? (
        <label className='flex cursor-pointer items-start gap-2.5 py-1'>
          <input
            type='checkbox'
            required
            checked={hasPendingReservationAcknowledgement}
            onChange={(event) => {
              markFormInteracted();
              onPendingReservationAcknowledgementChange(event.target.checked);
            }}
            className='es-focus-ring mt-1 h-4 w-4 shrink-0 es-accent-brand'
          />
          <span className='text-sm leading-[1.45] es-text-heading'>
            {content.pendingReservationAcknowledgementLabel}
            <span className='es-form-required-marker ml-0.5' aria-hidden='true'>
              *
            </span>
          </span>
        </label>
      ) : null}

      <label className='flex cursor-pointer items-start gap-2.5 py-1'>
        <input
          type='checkbox'
          required
          checked={hasTermsAgreement}
          onChange={(event) => {
            markFormInteracted();
            onTermsAgreementChange(event.target.checked);
          }}
          className='es-focus-ring mt-1 h-4 w-4 shrink-0 es-accent-brand'
        />
        <span className='text-sm leading-[1.45] es-text-heading'>
          {content.termsAgreementLabel}{' '}
          <SmartLink
            href={content.termsHref}
            openInNewTab
            className='es-focus-ring rounded-[2px] es-text-brand underline underline-offset-4'
            onClick={(event) => {
              event.stopPropagation();
            }}
          >
            {content.termsLinkLabel}
          </SmartLink>
          <span className='es-form-required-marker ml-0.5' aria-hidden='true'>
            *
          </span>
        </span>
      </label>
      {hasAcknowledgementsError ? (
        <p
          id={ACKNOWLEDGEMENT_ERROR_MESSAGE_ID}
          className='es-form-field-error'
          role='alert'
        >
          {content.acknowledgementRequiredError}
        </p>
      ) : null}

      <label className='flex cursor-pointer items-start gap-2.5 py-1'>
        <input
          type='checkbox'
          checked={marketingOptIn}
          onChange={(event) => {
            markFormInteracted();
            onMarketingOptInChange(event.target.checked);
          }}
          className='es-focus-ring mt-1 h-4 w-4 shrink-0 es-accent-brand'
        />
        <span className='text-sm leading-[1.45] es-text-heading'>
          {content.marketingOptInLabel}
        </span>
      </label>
    </div>
  );
}
