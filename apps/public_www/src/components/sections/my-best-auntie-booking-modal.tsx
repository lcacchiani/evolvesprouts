'use client';

import Image from 'next/image';
import Link from 'next/link';
import {
  type CSSProperties,
  type FormEvent,
  useEffect,
  useMemo,
  useState,
} from 'react';

import { ExternalLinkIcon } from '@/components/external-link-icon';
import {
  CloseButton,
  DiscountBadge,
  FpsQrCode,
  MODAL_PANEL_BACKGROUND,
  ModalOverlay,
} from '@/components/sections/booking-modal/shared';
import type { MyBestAuntieBookingContent } from '@/content';
import {
  applyDiscount,
  createMaskIconStyle,
  extractTimeRangeFromPartDate,
  toTransparentColor,
} from '@/components/sections/booking-modal/helpers';
import {
  createPublicCrmApiClient,
  isAbortRequestError,
} from '@/lib/crm-api-client';
import {
  BOOKING_HIGHLIGHT_ICON_COLOR,
  bodyTextStyle,
  headingTextStyle,
  TEXT_HEADING_STRONG,
} from '@/lib/design-tokens';
import {
  type DiscountRule,
  fetchDiscountRules,
} from '@/lib/discounts-data';
import { formatCurrencyHkd } from '@/lib/format';
import { useModalLockBody } from '@/lib/hooks/use-modal-lock-body';

export interface ReservationSummary {
  attendeeName: string;
  attendeeEmail: string;
  attendeePhone: string;
  childAgeGroup: string;
  packageLabel: string;
  monthLabel: string;
  paymentMethod: string;
  totalAmount: number;
  courseLabel: string;
  scheduleDateLabel?: string;
  scheduleTimeLabel?: string;
}

interface MyBestAuntieBookingModalProps {
  content: MyBestAuntieBookingContent['paymentModal'];
  initialMonthId?: string;
  selectedAgeGroupLabel?: string;
  learnMoreLabel?: string;
  learnMoreHref?: string;
  onClose: () => void;
  onSubmitReservation: (summary: ReservationSummary) => void;
}

type CoursePartRow = {
  label: string;
  date: string;
  description: string;
};

const PART_CHIP_ICON_MASK_PATH = '/images/cubes.svg';
const CALENDAR_ICON_MASK_PATH = '/images/calendar.svg';
const CREDIT_CARD_ICON_MASK_PATH = '/images/credit-card.svg';
const TARGET_ICON_MASK_PATH = '/images/target.svg';
const PART_CHIP_TONES = [
  {
    backgroundColor: 'var(--es-color-part-chip-blue-bg, #99BDE2)',
    color: 'var(--es-color-part-chip-blue-text, #073B6E)',
  },
  {
    backgroundColor: 'var(--es-color-part-chip-green-bg, #CDF0C9)',
    color: 'var(--es-color-part-chip-green-text, #2C6C25)',
  },
  {
    backgroundColor: 'var(--es-color-part-chip-yellow-bg, #FFE483)',
    color: 'var(--es-color-part-chip-yellow-text, #6B5400)',
  },
] as const;
const PART_ROW_GAP_REM = 2.5;
const PART_TIMELINE_LINE_WIDTH_PX = 25;
const PART_TIMELINE_CONTENT_GAP_PX = 25;
const PART_TIMELINE_SEGMENT_OVERLAP_PX = 12;
const PART_TIMELINE_SEGMENT_WHITE_GAP_PX = 5;
const PART_TIMELINE_GAP_CONNECTOR_HEIGHT_PX = 10;
const PART_TIMELINE_ITEM_PADDING_BOTTOM_PX = 100;
const PART_TIMELINE_LANE_WIDTH_PX =
  PART_TIMELINE_LINE_WIDTH_PX + PART_TIMELINE_CONTENT_GAP_PX;
const TIMELINE_GAP_WHITE =
  'var(--es-color-surface-white, #FFFFFF)';

const headingStyle: CSSProperties = headingTextStyle({
  lineHeight: 1.2,
});

const bodyStyle: CSSProperties = bodyTextStyle({
  lineHeight: 1.5,
});

function getPartChipTone(index: number): CSSProperties {
  const tone = PART_CHIP_TONES[index] ?? PART_CHIP_TONES[2];
  return {
    backgroundColor: tone.backgroundColor,
    color: tone.color,
  };
}

function getPartLineColor(index: number): string {
  return (PART_CHIP_TONES[index] ?? PART_CHIP_TONES[2]).backgroundColor;
}

function getPartLineStyle(index: number, isLastItem: boolean): CSSProperties {
  const rowGapHeight = isLastItem ? '' : ` + ${PART_ROW_GAP_REM}rem`;
  const overlapHeight = index === 0 ? '' : ` + ${PART_TIMELINE_SEGMENT_OVERLAP_PX}px`;
  const lineColor = getPartLineColor(index);

  const style: CSSProperties = {
    top: `${index === 0 ? 0 : -PART_TIMELINE_SEGMENT_OVERLAP_PX}px`,
    width: `${PART_TIMELINE_LINE_WIDTH_PX}px`,
    height: `calc(100%${rowGapHeight}${overlapHeight})`,
    backgroundColor: lineColor,
    borderTopLeftRadius: '999px',
    borderTopRightRadius: '999px',
    boxShadow:
      index === 0
        ? 'none'
        : `0 -${PART_TIMELINE_SEGMENT_WHITE_GAP_PX}px 0 0 ${TIMELINE_GAP_WHITE}`,
    zIndex: index + 1,
  };

  if (isLastItem) {
    style.background = `linear-gradient(to bottom, ${lineColor} 0%, ${lineColor} 68%, ${toTransparentColor(lineColor)} 100%)`;
  }

  return style;
}

function getPartGapConnectorStyle(index: number): CSSProperties {
  return {
    width: `${PART_TIMELINE_CONTENT_GAP_PX}px`,
    height: `${PART_TIMELINE_GAP_CONNECTOR_HEIGHT_PX}px`,
    backgroundColor: getPartLineColor(index),
    zIndex: index + 1,
  };
}

const partChipIconMaskStyle = createMaskIconStyle(
  PART_CHIP_ICON_MASK_PATH,
  'currentColor',
);
const darkCalendarIconMaskStyle = createMaskIconStyle(
  CALENDAR_ICON_MASK_PATH,
  TEXT_HEADING_STRONG,
);
const redCreditCardIconMaskStyle = createMaskIconStyle(
  CREDIT_CARD_ICON_MASK_PATH,
  BOOKING_HIGHLIGHT_ICON_COLOR,
);
const redTargetIconMaskStyle = createMaskIconStyle(
  TARGET_ICON_MASK_PATH,
  BOOKING_HIGHLIGHT_ICON_COLOR,
);

export function MyBestAuntieBookingModal({
  content,
  initialMonthId,
  selectedAgeGroupLabel = '',
  learnMoreLabel = '',
  learnMoreHref = '#',
  onClose,
  onSubmitReservation,
}: MyBestAuntieBookingModalProps) {
  const firstMonthId = content.monthOptions[0]?.id ?? '';
  const firstPackageId = content.packageOptions[0]?.id ?? '';
  const resolvedMonthId = content.monthOptions.some(
    (option) => option.id === initialMonthId,
  )
    ? (initialMonthId ?? firstMonthId)
    : firstMonthId;

  const [selectedMonthId] = useState(resolvedMonthId);
  const [selectedPackageId] = useState(firstPackageId);
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [interestedTopics, setInterestedTopics] = useState('');
  const [discountCode, setDiscountCode] = useState('');
  const [discountRules, setDiscountRules] = useState<DiscountRule[]>([]);
  const [discountRule, setDiscountRule] = useState<DiscountRule | null>(null);
  const [discountError, setDiscountError] = useState('');
  const [hasPendingReservationAcknowledgement, setHasPendingReservationAcknowledgement] =
    useState(false);
  const [hasTermsAgreement, setHasTermsAgreement] = useState(false);

  useModalLockBody({ onEscape: onClose });

  useEffect(() => {
    const controller = new AbortController();
    const crmApiClient = createPublicCrmApiClient();

    if (!crmApiClient) {
      return () => {
        controller.abort();
      };
    }

    fetchDiscountRules(crmApiClient, controller.signal)
      .then((remoteRules) => {
        setDiscountRules(remoteRules);
      })
      .catch((error) => {
        if (isAbortRequestError(error)) {
          return;
        }

        setDiscountRules([]);
      });

    return () => {
      controller.abort();
    };
  }, []);

  const selectedMonth =
    content.monthOptions.find((option) => option.id === selectedMonthId) ??
    content.monthOptions[0];
  const selectedPackage =
    content.packageOptions.find((option) => option.id === selectedPackageId) ??
    content.packageOptions[0];

  const originalAmount = selectedPackage?.price ?? 0;
  const totalAmount = useMemo(() => {
    return applyDiscount(originalAmount, discountRule);
  }, [discountRule, originalAmount]);
  const discountAmount = Math.max(0, originalAmount - totalAmount);
  const hasDiscount = discountAmount > 0;
  const hasConfirmedPriceDifference = totalAmount !== originalAmount;
  const isSubmitDisabled =
    !fullName.trim() ||
    !email.trim() ||
    !phone.trim() ||
    !hasPendingReservationAcknowledgement ||
    !hasTermsAgreement;

  const activePartRows = useMemo<CoursePartRow[]>(() => {
    const activeMonthId = selectedMonth?.id ?? '';

    return content.parts.map((part) => {
      const matchedDateEntry = Object.entries(part.dateByMonth).find(
        ([monthId]) => monthId === activeMonthId,
      );

      return {
        label: part.label,
        date: matchedDateEntry?.[1] ?? '',
        description: part.description,
      };
    });
  }, [content.parts, selectedMonth?.id]);

  const selectedTimeLabel = useMemo(() => {
    return extractTimeRangeFromPartDate(activePartRows[0]?.date ?? '');
  }, [activePartRows]);

  function handleApplyDiscount() {
    if (discountRule) {
      return;
    }

    const normalizedCode = discountCode.trim().toUpperCase();
    if (!normalizedCode) {
      setDiscountRule(null);
      setDiscountError(content.invalidDiscountLabel);
      return;
    }

    const matchedRule = discountRules.find(
      (entry) => entry.code.toUpperCase() === normalizedCode,
    );

    if (!matchedRule) {
      setDiscountRule(null);
      setDiscountError(content.invalidDiscountLabel);
      return;
    }

    setDiscountRule(matchedRule);
    setDiscountError('');
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedPackage || !selectedMonth || isSubmitDisabled) {
      return;
    }

    onSubmitReservation({
      attendeeName: fullName,
      attendeeEmail: email,
      attendeePhone: phone,
      childAgeGroup: selectedAgeGroupLabel,
      packageLabel: selectedPackage.label,
      monthLabel: selectedMonth.label,
      paymentMethod: content.paymentMethodValue,
      totalAmount,
      courseLabel: content.title,
      scheduleDateLabel: selectedMonth.label,
      scheduleTimeLabel: selectedTimeLabel,
    });
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
        <header className='flex justify-end px-4 pb-8 pt-6 sm:px-8 sm:pt-7'>
          <CloseButton label={content.closeLabel} onClose={onClose} />
        </header>
        <div className='relative max-h-[82vh] overflow-y-auto px-4 pb-5 sm:px-8 sm:pb-8'>
          <Image
            src='/images/evolvesprouts-logo.svg'
            alt=''
            width={446}
            height={592}
            className='pointer-events-none absolute left-0 top-0 hidden w-[250px] -translate-y-12 lg:block'
            aria-hidden='true'
          />

          <div className='relative z-10 flex flex-col gap-8 pb-9 lg:flex-row lg:gap-10 lg:pb-[72px]'>
            <div className='w-full lg:w-[calc(50%-20px)]'>
              <p className='text-[20px] leading-7 es-text-heading'>
                {content.thankYouLead}
              </p>
              <h2
                className='mt-1 text-[clamp(1.9rem,3.8vw,2.8rem)] leading-[1.1]'
                style={headingStyle}
              >
                {content.title}
              </h2>

              <section className='mt-8'>
                <ul className='space-y-10'>
                  {activePartRows.map((part, index) => (
                    <li
                      key={part.label}
                      className='relative'
                      style={{
                        paddingLeft: `${PART_TIMELINE_LANE_WIDTH_PX}px`,
                        paddingBottom: `${PART_TIMELINE_ITEM_PADDING_BOTTOM_PX}px`,
                      }}
                    >
                      <span
                        className='pointer-events-none absolute left-0 top-0 h-full'
                        aria-hidden='true'
                      >
                        <span
                          data-course-part-line='segment'
                          className='absolute left-0'
                          style={getPartLineStyle(
                            index,
                            index === activePartRows.length - 1,
                          )}
                        />
                      </span>
                      <div className='relative z-10 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4'>
                        <span
                          data-course-part-chip='true'
                          className='relative inline-flex self-start items-center gap-1.5 rounded-[112px] px-[15px] py-[5px]'
                          style={getPartChipTone(index)}
                        >
                          <span
                            data-course-part-line='gap-connector'
                            className='pointer-events-none absolute -left-[25px] top-1/2 -translate-y-1/2'
                            style={getPartGapConnectorStyle(index)}
                            aria-hidden='true'
                          />
                          <span
                            className='h-[30px] w-[30px] shrink-0'
                            style={partChipIconMaskStyle}
                            aria-hidden='true'
                          />
                          <span className='text-[18px] font-semibold leading-none'>
                            {part.label}
                          </span>
                        </span>

                        <div className='max-w-[340px]'>
                          <div data-course-part-date-block='true'>
                            <span
                              data-course-part-date-icon='true'
                              className='inline-block h-6 w-6 shrink-0'
                              style={darkCalendarIconMaskStyle}
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
                    <span className='flex h-[72px] w-[72px] shrink-0 items-center justify-center rounded-full es-bg-surface-icon-soft'>
                      <span
                        className='h-[46px] w-[46px] shrink-0'
                        style={redCreditCardIconMaskStyle}
                        aria-hidden='true'
                      />
                    </span>
                    <div>
                      <p className='text-[20px] font-semibold leading-6 es-text-heading'>
                        {content.totalAmountLabel}
                      </p>
                      <p className='mt-2 text-[30px] font-bold leading-none es-text-heading'>
                        {formatCurrencyHkd(originalAmount)}
                      </p>
                      <p className='mt-4 text-[18px] font-semibold leading-[26px] es-text-heading'>
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
                    <span className='flex h-[72px] w-[72px] shrink-0 items-center justify-center rounded-full es-bg-surface-icon-soft'>
                      <span
                        className='h-[46px] w-[46px] shrink-0'
                        style={redTargetIconMaskStyle}
                        aria-hidden='true'
                      />
                    </span>
                    <div>
                      <p className='text-[20px] font-semibold leading-6 es-text-heading'>
                        {content.locationName}
                      </p>
                      <p className='mt-1 text-[18px] font-semibold leading-[26px] es-text-heading'>
                        {content.locationAddress}
                      </p>
                      <a
                        href={content.directionHref}
                        target='_blank'
                        rel='noopener noreferrer'
                        className='mt-3 inline-flex items-center gap-1.5 text-[18px] font-semibold leading-none es-text-heading'
                      >
                        <span className='underline underline-offset-4'>
                          {content.directionLabel}
                        </span>
                        <ExternalLinkIcon className='h-[18px] w-[18px] shrink-0' />
                      </a>
                    </div>
                  </div>
                </div>

                {learnMoreLabel && (
                  <div className='mt-8'>
                    <Link
                      href={learnMoreHref}
                      className='es-focus-ring es-modal-outline-brand-button inline-flex h-[56px] items-center justify-center rounded-[10px] border px-7 text-base font-semibold'
                    >
                      {learnMoreLabel}
                    </Link>
                  </div>
                )}
              </section>
            </div>

            <div className='w-full lg:w-[calc(50%-20px)]'>
              <section className='relative overflow-hidden rounded-[14px] border es-border-panel es-bg-surface-muted px-5 py-7 sm:px-7'>
                <Image
                  src='/images/evolvesprouts-logo.svg'
                  alt=''
                  width={276}
                  height={267}
                  className='pointer-events-none absolute -right-5 -top-6 hidden w-[220px] sm:block'
                  aria-hidden='true'
                />

                <h3 className='relative z-10 text-[30px] font-bold leading-none es-text-heading'>
                  {content.reservationTitle}
                </h3>

                <form className='relative z-10 mt-4 space-y-3' onSubmit={handleSubmit}>
                  <label className='block'>
                    <span className='mb-1 block text-sm font-semibold es-text-heading'>
                      {content.fullNameLabel}
                      <span className='es-modal-required-marker ml-0.5' aria-hidden='true'>
                        *
                      </span>
                    </span>
                    <input
                      type='text'
                      required
                      value={fullName}
                      onChange={(event) => {
                        setFullName(event.target.value);
                      }}
                      className='es-focus-ring es-modal-input w-full rounded-[14px] border px-4 py-3 text-[16px] font-semibold'
                    />
                  </label>
                  <label className='block'>
                    <span className='mb-1 block text-sm font-semibold es-text-heading'>
                      {content.emailLabel}
                      <span className='es-modal-required-marker ml-0.5' aria-hidden='true'>
                        *
                      </span>
                    </span>
                    <input
                      type='email'
                      required
                      value={email}
                      onChange={(event) => {
                        setEmail(event.target.value);
                      }}
                      className='es-focus-ring es-modal-input w-full rounded-[14px] border px-4 py-3 text-[16px] font-semibold'
                    />
                  </label>
                  <label className='block'>
                    <span className='mb-1 block text-sm font-semibold es-text-heading'>
                      {content.phoneLabel}
                      <span className='es-modal-required-marker ml-0.5' aria-hidden='true'>
                        *
                      </span>
                    </span>
                    <input
                      type='tel'
                      required
                      value={phone}
                      onChange={(event) => {
                        setPhone(event.target.value);
                      }}
                      className='es-focus-ring es-modal-input w-full rounded-[14px] border px-4 py-3 text-[16px] font-semibold'
                    />
                  </label>
                  <label className='block'>
                    <span className='mb-1 block text-sm font-semibold es-text-heading'>
                      {content.topicsInterestLabel}
                    </span>
                    <textarea
                      value={interestedTopics}
                      onChange={(event) => {
                        setInterestedTopics(event.target.value);
                      }}
                      placeholder={content.topicsInterestPlaceholder}
                      rows={3}
                      className='es-focus-ring es-modal-input w-full resize-y rounded-[14px] border px-4 py-3 text-[16px] font-semibold'
                    />
                  </label>

                  <div className='grid grid-cols-[1fr_auto] gap-2'>
                    <label>
                      <span className='mb-1 block text-sm font-semibold es-text-heading'>
                        {content.discountCodeLabel}
                      </span>
                      <input
                        type='text'
                        value={discountCode}
                        disabled={Boolean(discountRule)}
                        onChange={(event) => {
                          setDiscountCode(event.target.value);
                          setDiscountError('');
                        }}
                        placeholder={content.discountCodePlaceholder}
                        className='es-focus-ring es-modal-input w-full rounded-[14px] border px-4 py-3 text-[16px] font-semibold'
                      />
                    </label>
                    <button
                      type='button'
                      onClick={handleApplyDiscount}
                      disabled={Boolean(discountRule)}
                      className='es-focus-ring es-modal-outline-brand-button mt-6 inline-flex h-[50px] items-center justify-center rounded-[10px] border px-4 text-sm font-semibold'
                    >
                      {content.applyDiscountLabel}
                    </button>
                  </div>

                  {discountRule && (
                    <DiscountBadge label={content.discountAppliedLabel} />
                  )}
                  {discountError && (
                    <p className='text-sm font-semibold es-text-danger-strong'>
                      {discountError}
                    </p>
                  )}

                  <div
                    data-booking-price-breakdown='true'
                    className='space-y-2 rounded-[12px] border es-border-panel-soft bg-white p-4'
                  >
                    <div className='flex items-center justify-between text-sm font-semibold es-text-body'>
                      <span>Price</span>
                      <span>{formatCurrencyHkd(originalAmount)}</span>
                    </div>
                    {hasDiscount && (
                      <div className='flex items-center justify-between text-sm font-semibold es-text-success'>
                        <span>Discount</span>
                        <span>-{formatCurrencyHkd(discountAmount)}</span>
                      </div>
                    )}
                    {hasConfirmedPriceDifference && (
                      <div className='flex items-center justify-between border-t es-border-divider pt-2 text-sm font-bold es-text-heading'>
                        <span>Confirmed Price</span>
                        <span>{formatCurrencyHkd(totalAmount)}</span>
                      </div>
                    )}
                  </div>

                  <div data-booking-fps-block='true' className='w-full p-4'>
                    <FpsQrCode amount={totalAmount} />
                  </div>

                  <div data-booking-acknowledgements='true' className='space-y-2'>
                    <label className='flex items-start gap-2.5 py-1'>
                      <input
                        type='checkbox'
                        required
                        checked={hasPendingReservationAcknowledgement}
                        onChange={(event) => {
                          setHasPendingReservationAcknowledgement(event.target.checked);
                        }}
                        className='es-focus-ring mt-1 h-4 w-4 shrink-0 es-accent-brand'
                      />
                      <span className='text-sm leading-[1.45] es-text-heading'>
                        {content.pendingReservationAcknowledgementLabel}
                        <span className='es-modal-required-marker ml-0.5' aria-hidden='true'>
                          *
                        </span>
                      </span>
                    </label>

                    <label className='flex items-start gap-2.5 py-1'>
                      <input
                        type='checkbox'
                        required
                        checked={hasTermsAgreement}
                        onChange={(event) => {
                          setHasTermsAgreement(event.target.checked);
                        }}
                        className='es-focus-ring mt-1 h-4 w-4 shrink-0 es-accent-brand'
                      />
                      <span className='text-sm leading-[1.45] es-text-heading'>
                        {content.termsAgreementLabel}{' '}
                        <Link
                          href={content.termsHref}
                          target='_blank'
                          rel='noopener noreferrer'
                          className='es-focus-ring rounded-[2px] es-text-brand underline underline-offset-4'
                          onClick={(event) => {
                            event.stopPropagation();
                          }}
                        >
                          {content.termsLinkLabel}
                        </Link>
                        <span className='es-modal-required-marker ml-0.5' aria-hidden='true'>
                          *
                        </span>
                      </span>
                    </label>
                  </div>

                  <button
                    type='submit'
                    disabled={isSubmitDisabled}
                    className='es-focus-ring es-cta-button es-cta-primary es-primary-cta es-modal-submit-button mt-1 w-full'
                  >
                    {content.submitLabel}
                  </button>
                </form>
              </section>
            </div>
          </div>

        </div>
      </section>
    </ModalOverlay>
  );
}

export { MyBestAuntieThankYouModal } from '@/components/sections/booking-modal/thank-you-modal';
