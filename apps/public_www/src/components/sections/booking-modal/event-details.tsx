import { ButtonPrimitive } from '@/components/shared/button-primitive';
import { ExternalLinkInlineContent } from '@/components/shared/external-link-icon';
import { SmartLink } from '@/components/shared/smart-link';
import type { MyBestAuntieBookingContent } from '@/content';
import { formatCurrencyHkd } from '@/lib/format';

export interface BookingEventDetailPart {
  label: string;
  date: string;
  description: string;
}

interface BookingEventDetailsProps {
  headingId: string;
  content: MyBestAuntieBookingContent['paymentModal'];
  activePartRows: BookingEventDetailPart[];
  originalAmount: number;
  learnMoreLabel: string;
  learnMoreHref: string;
}

const PART_CHIP_TONES = ['blue', 'green', 'yellow'] as const;
type PartChipTone = (typeof PART_CHIP_TONES)[number];

function resolvePartChipTone(index: number): PartChipTone {
  return PART_CHIP_TONES[index] ?? PART_CHIP_TONES[PART_CHIP_TONES.length - 1];
}

function getPartChipClassName(index: number): string {
  return `es-my-best-auntie-booking-part-chip es-my-best-auntie-booking-part-chip--${resolvePartChipTone(index)}`;
}

function getPartLineClassName(index: number, isLastItem: boolean): string {
  const tone = resolvePartChipTone(index);
  const baseClassName = `es-my-best-auntie-booking-part-line es-my-best-auntie-booking-part-line--tone-${tone}`;

  if (isLastItem) {
    return `${baseClassName} ${
      index === 0
        ? 'es-my-best-auntie-booking-part-line--last-first'
        : 'es-my-best-auntie-booking-part-line--last-stacked'
    }`;
  }

  return `${baseClassName} ${
    index === 0
      ? 'es-my-best-auntie-booking-part-line--with-gap-first'
      : 'es-my-best-auntie-booking-part-line--with-gap-stacked'
  }`;
}

function getPartGapConnectorClassName(index: number): string {
  return `es-my-best-auntie-booking-part-gap-connector es-my-best-auntie-booking-part-gap-connector--${resolvePartChipTone(index)}`;
}

export function BookingEventDetails({
  headingId,
  content,
  activePartRows,
  originalAmount,
  learnMoreLabel,
  learnMoreHref,
}: BookingEventDetailsProps) {
  return (
    <div className='w-full lg:w-[calc(50%-20px)]'>
      <p className='text-xl leading-7 es-text-heading'>
        {content.thankYouLead}
      </p>
      <h2
        id={headingId}
        className='es-type-title es-my-best-auntie-booking-modal-heading mt-1'
      >
        {content.title}
      </h2>

      <section className='mt-8'>
        <ul className='space-y-10'>
          {activePartRows.map((part, index) => (
            <li
              key={part.label}
              className='es-my-best-auntie-booking-part-item relative'
            >
              <span
                className='pointer-events-none absolute left-0 top-0 h-full'
                aria-hidden='true'
              >
                <span
                  data-course-part-line='segment'
                  className={`absolute left-0 ${getPartLineClassName(
                    index,
                    index === activePartRows.length - 1,
                  )}`}
                />
              </span>
              <div className='relative z-10 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4'>
                <span
                  data-course-part-chip='true'
                  className={`relative inline-flex self-start items-center gap-1.5 rounded-full px-[15px] py-[5px] ${getPartChipClassName(index)}`}
                >
                  <span
                    data-course-part-line='gap-connector'
                    className={`pointer-events-none absolute -left-[25px] top-1/2 -translate-y-1/2 ${getPartGapConnectorClassName(index)}`}
                    aria-hidden='true'
                  />
                  <span
                    className='es-mask-cubes-current h-[30px] w-[30px] shrink-0'
                    aria-hidden='true'
                  />
                  <span className='text-lg font-semibold leading-none'>
                    {part.label}
                  </span>
                </span>

                <div className='max-w-[340px]'>
                  <div data-course-part-date-block='true'>
                    <span
                      data-course-part-date-icon='true'
                      className='es-mask-calendar-heading inline-block h-6 w-6 shrink-0'
                      aria-hidden='true'
                    />
                    <p className='mt-1 text-[17px] font-semibold leading-6 es-text-heading'>
                      {part.date}
                    </p>
                  </div>
                  <p className='mt-2 text-[15px] leading-[22px] es-text-body'>
                    {part.description}
                  </p>
                </div>
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section className='mt-9'>
        <div className='border-b border-black/15 pb-8'>
          <h3 className='text-[28px] font-bold leading-none es-text-heading'>
            {content.pricingTitle}
          </h3>
          <div className='mt-4 flex items-start gap-4'>
            <span className='es-icon-circle-lg'>
              <span
                className='es-mask-credit-card-danger h-[46px] w-[46px] shrink-0'
                aria-hidden='true'
              />
            </span>
            <div>
              <p className='text-xl font-semibold leading-6 es-text-heading'>
                {content.totalAmountLabel}
              </p>
              <p className='mt-2 text-[30px] font-bold leading-none es-text-heading'>
                {formatCurrencyHkd(originalAmount)}
              </p>
              <p className='mt-4 text-lg font-semibold leading-[26px] es-text-heading'>
                {content.refundHint}
              </p>
            </div>
          </div>
        </div>

        <div className='border-b border-black/15 pb-8 pt-8'>
          <h3 className='text-[28px] font-bold leading-none es-text-heading'>
            {content.locationTitle}
          </h3>
          <div className='mt-4 flex items-start gap-4'>
            <span className='es-icon-circle-lg'>
              <span
                className='es-mask-target-danger h-[46px] w-[46px] shrink-0'
                aria-hidden='true'
              />
            </span>
            <div>
              <p className='text-xl font-semibold leading-6 es-text-heading'>
                {content.locationName}
              </p>
              <p className='mt-1 text-lg font-semibold leading-[26px] es-text-heading'>
                {content.locationAddress}
              </p>
              <SmartLink
                href={content.directionHref}
                className='mt-3 inline-flex items-center text-lg font-semibold leading-none es-text-heading'
              >
                {({ isExternalHttp }) => (
                  <ExternalLinkInlineContent isExternalHttp={isExternalHttp}>
                    {content.directionLabel}
                  </ExternalLinkInlineContent>
                )}
              </SmartLink>
            </div>
          </div>
        </div>

        {learnMoreLabel ? (
          <div className='mt-8'>
            <ButtonPrimitive
              href={learnMoreHref}
              variant='outline'
              className='h-[56px] rounded-control px-7 text-base font-semibold'
            >
              {learnMoreLabel}
            </ButtonPrimitive>
          </div>
        ) : null}
      </section>
    </div>
  );
}
