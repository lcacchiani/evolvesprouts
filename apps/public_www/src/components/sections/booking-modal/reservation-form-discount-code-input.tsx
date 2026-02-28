import { ButtonPrimitive } from '@/components/shared/button-primitive';
import type { MyBestAuntieBookingContent } from '@/content';

const DISCOUNT_ERROR_MESSAGE_ID = 'booking-modal-discount-error-message';

interface ReservationFormDiscountCodeInputProps {
  content: MyBestAuntieBookingContent['paymentModal'];
  discountCode: string;
  discountError: string;
  hasDiscountRule: boolean;
  isDiscountValidationSubmitting: boolean;
  onDiscountCodeChange: (value: string) => void;
  onApplyDiscount: () => void;
}

export function ReservationFormDiscountCodeInput({
  content,
  discountCode,
  discountError,
  hasDiscountRule,
  isDiscountValidationSubmitting,
  onDiscountCodeChange,
  onApplyDiscount,
}: ReservationFormDiscountCodeInputProps) {
  return (
    <>
      <div className='grid grid-cols-[1fr_auto] gap-2'>
        <label>
          <span className='mb-1 block text-sm font-semibold es-text-heading'>
            {content.discountCodeLabel}
          </span>
          <input
            type='text'
            value={discountCode}
            disabled={hasDiscountRule}
            aria-invalid={Boolean(discountError)}
            aria-describedby={discountError ? DISCOUNT_ERROR_MESSAGE_ID : undefined}
            onChange={(event) => {
              onDiscountCodeChange(event.target.value);
            }}
            placeholder={content.discountCodePlaceholder}
            className='es-focus-ring es-form-input'
          />
        </label>
        <ButtonPrimitive
          variant='outline'
          onClick={onApplyDiscount}
          disabled={hasDiscountRule || isDiscountValidationSubmitting}
          className='mt-6 h-[50px] rounded-control px-4 text-sm font-semibold'
        >
          {content.applyDiscountLabel}
        </ButtonPrimitive>
      </div>

      {discountError ? (
        <p
          id={DISCOUNT_ERROR_MESSAGE_ID}
          className='text-sm font-semibold es-text-danger-strong'
          role='alert'
        >
          {discountError}
        </p>
      ) : null}
    </>
  );
}
