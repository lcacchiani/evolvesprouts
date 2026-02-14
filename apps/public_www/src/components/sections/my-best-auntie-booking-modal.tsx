'use client';

import Image from 'next/image';
import Link from 'next/link';
import {
  type CSSProperties,
  type FormEvent,
  type ReactNode,
  useEffect,
  useMemo,
  useState,
} from 'react';

import type { Locale, MyBestAuntieBookingContent } from '@/content';
import { BODY_TEXT_COLOR, HEADING_TEXT_COLOR } from '@/lib/design-tokens';
import {
  buildDiscountsApiUrl,
  type DiscountRule,
  fetchDiscountRules,
  normalizeStaticDiscountRules,
  resolveRuntimeDiscountsApiUrl,
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

interface MyBestAuntieThankYouModalProps {
  locale: Locale;
  content: MyBestAuntieBookingContent['thankYouModal'];
  summary: ReservationSummary | null;
  homeHref: string;
  onClose: () => void;
}

type CoursePartRow = {
  label: string;
  date: string;
  description: string;
};

const MODAL_PANEL_BACKGROUND = '#FFFFFF';
const MODAL_OVERLAY_BACKGROUND = 'rgba(16, 14, 11, 0.6)';
const CHROME_BACKGROUND = '#FFF7F1';
const CHROME_BORDER = '#EECAB0';
const PART_CHIP_ICON_PATHS = [
  '/images/my-best-auntie-booking/box-1.png',
  '/images/my-best-auntie-booking/box-2.png',
  '/images/my-best-auntie-booking/box-3.png',
] as const;
const PART_LINE_PATHS = [
  '/images/my-best-auntie-booking/pay-part-1-line.png',
  '/images/my-best-auntie-booking/pay-part-2-line.png',
  '/images/my-best-auntie-booking/pay-part-3-line.png',
] as const;
const PART_CHIP_TONES = [
  {
    backgroundColor: '#99BDE2',
    color: '#073B6E',
  },
  {
    backgroundColor: '#CDF0C9',
    color: '#2C6C25',
  },
  {
    backgroundColor: '#FFE483',
    color: '#6B5400',
  },
] as const;

const headingStyle: CSSProperties = {
  color: HEADING_TEXT_COLOR,
  fontFamily: 'var(--figma-fontfamilies-poppins, Poppins), sans-serif',
  fontWeight: 700,
  lineHeight: 1.2,
};

const bodyStyle: CSSProperties = {
  color: BODY_TEXT_COLOR,
  fontFamily: 'var(--figma-fontfamilies-lato, Lato), sans-serif',
  fontWeight: 400,
  lineHeight: 1.5,
};

function applyDiscount(basePrice: number, rule: DiscountRule | null): number {
  if (!rule) {
    return basePrice;
  }

  if (rule.type === 'percent') {
    return Math.max(0, Math.round(basePrice * (1 - rule.value / 100)));
  }

  return Math.max(0, basePrice - rule.value);
}

function resolveLocalizedDate(locale: Locale): string {
  const dateFormatter = new Intl.DateTimeFormat(locale, {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });

  return dateFormatter.format(new Date());
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function ModalOverlay({
  onClose,
  children,
}: {
  onClose: () => void;
  children: ReactNode;
}) {
  return (
    <div className='fixed inset-0 z-[80] overflow-y-auto'>
      <button
        type='button'
        aria-label='Close modal'
        className='absolute inset-0'
        style={{ backgroundColor: MODAL_OVERLAY_BACKGROUND }}
        onClick={onClose}
      />
      <div className='relative z-10 flex min-h-full items-start justify-center px-4 pb-4 pt-6 sm:px-6 sm:pt-8'>
        {children}
      </div>
    </div>
  );
}

function CloseButton({ label, onClose }: { label: string; onClose: () => void }) {
  return (
    <button
      type='button'
      aria-label={label}
      onClick={onClose}
      className='es-focus-ring inline-flex h-10 w-10 items-center justify-center rounded-full bg-[#E9E9E9] text-[#333333]'
    >
      <svg
        aria-hidden='true'
        viewBox='0 0 16 16'
        className='h-4 w-4'
        fill='none'
        xmlns='http://www.w3.org/2000/svg'
      >
        <path
          d='M3 3L13 13M13 3L3 13'
          stroke='currentColor'
          strokeWidth='1.8'
          strokeLinecap='round'
        />
      </svg>
    </button>
  );
}

function QrPlaceholder({ label }: { label: string }) {
  return (
    <div className='mx-auto w-full max-w-[180px] rounded-[14px] border border-[#CAD6E5] bg-white p-3 text-center'>
      <div className='mx-auto grid h-[106px] w-[106px] grid-cols-5 gap-1 rounded-[10px] bg-[#FFF7F1] p-2'>
        {Array.from({ length: 25 }).map((_, index) => (
          <span
            key={index}
            className={`rounded-[3px] ${index % 2 === 0 ? 'bg-black' : 'bg-transparent'}`}
          />
        ))}
      </div>
      <p className='mt-2 text-xs font-semibold text-[#5B617F]'>{label}</p>
    </div>
  );
}

function DiscountBadge({ label }: { label: string }) {
  return (
    <p className='rounded-lg bg-[#E9F8EA] px-3 py-2 text-sm text-[#276738]'>
      {label}
    </p>
  );
}

function getPartChipIconPath(index: number): string {
  return PART_CHIP_ICON_PATHS[index] ?? PART_CHIP_ICON_PATHS[2];
}

function getPartLinePath(index: number): string {
  return PART_LINE_PATHS[index] ?? PART_LINE_PATHS[2];
}

function getPartChipTone(index: number): CSSProperties {
  const tone = PART_CHIP_TONES[index] ?? PART_CHIP_TONES[2];
  return {
    backgroundColor: tone.backgroundColor,
    color: tone.color,
  };
}

function extractTimeRangeFromPartDate(partDate: string): string {
  const rawSegments = partDate.split('@');
  if (rawSegments.length < 2) {
    return '';
  }
  return rawSegments[1]?.trim() ?? '';
}

export function MyBestAuntieBookingModal({
  content,
  initialMonthId,
  selectedAgeGroupLabel = '',
  learnMoreLabel = '',
  learnMoreHref = '#',
  onClose,
  onSubmitReservation,
}: MyBestAuntieBookingModalProps) {
  const fallbackDiscountRules = useMemo(
    () => normalizeStaticDiscountRules(content.discountCodes),
    [content.discountCodes],
  );
  const crmApiKey = process.env.NEXT_PUBLIC_WWW_CRM_API_KEY ?? '';
  const crmApiBaseUrl = process.env.NEXT_PUBLIC_WWW_CRM_API_BASE_URL ?? '';

  const firstMonthId = content.monthOptions[0]?.id ?? '';
  const firstPackageId = content.packageOptions[0]?.id ?? '';
  const resolvedMonthId = content.monthOptions.some(
    (option) => option.id === initialMonthId,
  )
    ? (initialMonthId ?? firstMonthId)
    : firstMonthId;

  const [selectedMonthId, setSelectedMonthId] = useState(resolvedMonthId);
  const [selectedPackageId, setSelectedPackageId] = useState(firstPackageId);
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [discountCode, setDiscountCode] = useState('');
  const [discountRules, setDiscountRules] =
    useState<DiscountRule[]>(fallbackDiscountRules);
  const [discountRule, setDiscountRule] = useState<DiscountRule | null>(null);
  const [discountError, setDiscountError] = useState('');
  const [isDiscountRulesLoading, setIsDiscountRulesLoading] = useState(false);

  useModalLockBody({ onEscape: onClose });

  useEffect(() => {
    setDiscountRules(fallbackDiscountRules);
  }, [fallbackDiscountRules]);

  useEffect(() => {
    const controller = new AbortController();
    const normalizedApiKey = crmApiKey.trim();
    const discountApiUrl = buildDiscountsApiUrl(crmApiBaseUrl);

    if (!normalizedApiKey || !discountApiUrl) {
      setDiscountRules(fallbackDiscountRules);
      setIsDiscountRulesLoading(false);
      return () => {
        controller.abort();
      };
    }

    const apiUrl = resolveRuntimeDiscountsApiUrl(discountApiUrl);

    setIsDiscountRulesLoading(true);

    fetchDiscountRules(apiUrl, normalizedApiKey, controller.signal)
      .then((remoteRules) => {
        if (remoteRules.length > 0) {
          setDiscountRules(remoteRules);
          return;
        }

        setDiscountRules(fallbackDiscountRules);
      })
      .catch((error) => {
        if (error instanceof Error && error.name === 'AbortError') {
          return;
        }

        setDiscountRules(fallbackDiscountRules);
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setIsDiscountRulesLoading(false);
        }
      });

    return () => {
      controller.abort();
    };
  }, [crmApiBaseUrl, crmApiKey, fallbackDiscountRules]);

  const selectedMonth =
    content.monthOptions.find((option) => option.id === selectedMonthId) ??
    content.monthOptions[0];
  const selectedPackage =
    content.packageOptions.find((option) => option.id === selectedPackageId) ??
    content.packageOptions[0];

  const totalAmount = useMemo(() => {
    return applyDiscount(selectedPackage?.price ?? 0, discountRule);
  }, [discountRule, selectedPackage?.price]);

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
    if (!selectedPackage || !selectedMonth) {
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
            src='/images/my-best-auntie-booking/modal-big-tree.png'
            alt=''
            width={446}
            height={592}
            className='pointer-events-none absolute left-0 top-0 hidden w-[250px] -translate-y-12 lg:block'
            aria-hidden='true'
          />

          <div className='relative z-10 flex flex-col gap-8 border-b border-black/10 pb-9 lg:flex-row lg:gap-10 lg:pb-[72px]'>
            <div className='w-full lg:w-[calc(50%-20px)]'>
              <p className='text-[20px] leading-7 text-[#333333]'>
                {content.thankYouLead}
              </p>
              <h2
                className='mt-1 text-[clamp(1.9rem,3.8vw,2.8rem)] leading-[1.1]'
                style={headingStyle}
              >
                {content.title}
              </h2>

              <section className='mt-7 rounded-[14px] border border-[#ECD8C7] bg-[#FFF9F4] p-4 sm:p-5'>
                <h3 className='text-[20px] font-semibold text-[#333333]'>
                  {content.monthLabel}
                </h3>
                <div className='mt-3 flex flex-wrap gap-2'>
                  {content.monthOptions.map((option) => {
                    const isActive = option.id === selectedMonthId;
                    return (
                      <button
                        key={option.id}
                        type='button'
                        onClick={() => {
                          setSelectedMonthId(option.id);
                        }}
                        className='es-focus-ring rounded-full px-4 py-2 text-[15px] font-semibold'
                        style={{
                          backgroundColor: isActive ? '#C84A16' : CHROME_BACKGROUND,
                          color: isActive ? '#FFFFFF' : '#333333',
                          border: `1px solid ${CHROME_BORDER}`,
                        }}
                      >
                        {option.label}
                      </button>
                    );
                  })}
                </div>

                <h3 className='mt-5 text-[20px] font-semibold text-[#333333]'>
                  {content.packageLabel}
                </h3>
                <ul className='mt-3 space-y-2'>
                  {content.packageOptions.map((option) => {
                    const isActive = option.id === selectedPackageId;
                    return (
                      <li key={option.id}>
                        <button
                          type='button'
                          onClick={() => {
                            setSelectedPackageId(option.id);
                          }}
                          className='es-focus-ring w-full rounded-[12px] px-4 py-3 text-left'
                          style={{
                            border: `1px solid ${isActive ? '#C84A16' : CHROME_BORDER}`,
                            backgroundColor: isActive ? '#FFF0E5' : '#FFFFFF',
                          }}
                        >
                          <div className='flex items-center justify-between gap-3'>
                            <p className='font-semibold text-[#333333]'>
                              {option.label}
                            </p>
                            <p className='font-semibold text-[#333333]'>
                              {formatCurrencyHkd(option.price)}
                            </p>
                          </div>
                          <p className='mt-1 text-sm text-[#4A4A4A]'>
                            {option.description}
                          </p>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </section>

              <section className='mt-8'>
                <h3 className='text-[30px] font-bold leading-none text-[#333333]'>
                  {content.courseScheduleTitle}
                </h3>
                <ul className='mt-5 space-y-10'>
                  {activePartRows.map((part, index) => (
                    <li key={part.label} className='relative pl-[34px]'>
                      <Image
                        src={getPartLinePath(index)}
                        alt=''
                        width={58}
                        height={225}
                        className='pointer-events-none absolute left-0 top-0 h-[225px] w-[58px]'
                        aria-hidden='true'
                      />
                      <div className='relative z-10 flex flex-col gap-3 sm:flex-row sm:justify-between sm:gap-4'>
                        <span
                          className='inline-flex items-center gap-1.5 rounded-[112px] px-[15px] py-[5px]'
                          style={getPartChipTone(index)}
                        >
                          <Image
                            src={getPartChipIconPath(index)}
                            alt=''
                            width={30}
                            height={30}
                            aria-hidden='true'
                          />
                          <span className='text-[18px] font-semibold leading-none'>
                            {part.label}
                          </span>
                        </span>

                        <div className='max-w-[340px]'>
                          <div className='flex items-center gap-2'>
                            <Image
                              src='/images/my-best-auntie-booking/pay-calendar.png'
                              alt=''
                              width={24}
                              height={24}
                              aria-hidden='true'
                            />
                            <p className='text-[17px] font-semibold leading-6 text-[#333333]'>
                              {part.date}
                            </p>
                          </div>
                          <p className='mt-2 text-[15px] leading-[22px] text-[#4A4A4A]'>
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
                  <h3 className='text-[28px] font-bold leading-none text-[#333333]'>
                    {content.pricingTitle}
                  </h3>
                  <div className='mt-4 flex items-start gap-4'>
                    <span className='flex h-[72px] w-[72px] shrink-0 items-center justify-center rounded-full bg-[#F3E3D8]'>
                      <Image
                        src='/images/my-best-auntie-booking/price-card.png'
                        alt=''
                        width={46}
                        height={46}
                        aria-hidden='true'
                      />
                    </span>
                    <div>
                      <p className='text-[20px] font-semibold leading-6 text-[#333333]'>
                        {content.totalAmountLabel}
                      </p>
                      <p className='mt-2 text-[30px] font-bold leading-none text-[#333333]'>
                        {formatCurrencyHkd(totalAmount)}
                      </p>
                      <p className='mt-4 text-[18px] font-semibold leading-[26px] text-[#333333]'>
                        {content.refundHint}
                      </p>
                    </div>
                  </div>
                </div>

                <div className='pt-8'>
                  <h3 className='text-[28px] font-bold leading-none text-[#333333]'>
                    {content.locationTitle}
                  </h3>
                  <div className='mt-4 flex items-start gap-4'>
                    <span className='flex h-[72px] w-[72px] shrink-0 items-center justify-center rounded-full bg-[#F3E3D8]'>
                      <Image
                        src='/images/my-best-auntie-booking/location.png'
                        alt=''
                        width={46}
                        height={46}
                        aria-hidden='true'
                      />
                    </span>
                    <div>
                      <p className='text-[20px] font-semibold leading-6 text-[#333333]'>
                        {content.locationName}
                      </p>
                      <p className='mt-1 text-[18px] font-semibold leading-[26px] text-[#333333]'>
                        {content.locationAddress}
                      </p>
                      <a
                        href={content.directionHref}
                        target='_blank'
                        rel='noopener noreferrer'
                        className='mt-3 inline-flex items-center gap-1.5 text-[18px] font-semibold leading-none text-[#333333] underline underline-offset-4'
                      >
                        <Image
                          src='/images/my-best-auntie-booking/direction-mark.png'
                          alt=''
                          width={24}
                          height={24}
                          aria-hidden='true'
                        />
                        {content.directionLabel}
                      </a>
                    </div>
                  </div>
                </div>

                {learnMoreLabel && (
                  <div className='mt-8'>
                    <Link
                      href={learnMoreHref}
                      className='es-focus-ring inline-flex h-[56px] items-center justify-center rounded-[10px] border border-[#C84A16] px-7 text-base font-semibold text-[#C84A16]'
                    >
                      {learnMoreLabel}
                    </Link>
                  </div>
                )}
              </section>
            </div>

            <div className='w-full lg:w-[calc(50%-20px)]'>
              <section className='relative overflow-hidden rounded-[14px] border border-[#D0E4F4] bg-[#F8F8F8] px-5 py-7 shadow-[0_8px_8px_rgba(49,86,153,0.08),0_8px_16px_rgba(49,86,153,0.06)] sm:px-7'>
                <Image
                  src='/images/my-best-auntie-booking/small-tree-form.png'
                  alt=''
                  width={276}
                  height={267}
                  className='pointer-events-none absolute -right-5 -top-6 hidden w-[220px] sm:block'
                  aria-hidden='true'
                />

                <h3 className='relative z-10 text-[30px] font-bold leading-none text-[#333333]'>
                  {content.reservationTitle}
                </h3>
                <p
                  className='relative z-10 mt-2 text-sm text-[#4A4A4A]'
                  style={bodyStyle}
                >
                  {content.reservationDescription}
                </p>

                {selectedAgeGroupLabel && (
                  <div className='relative z-10 mt-3 rounded-[12px] border border-[#CAD6E5] bg-white px-4 py-3'>
                    <p className='text-sm text-[#5A5A5A]'>
                      {content.selectedAgeGroupLabel}
                    </p>
                    <p className='font-semibold text-[#333333]'>
                      {selectedAgeGroupLabel}
                    </p>
                  </div>
                )}

                <form className='relative z-10 mt-4 space-y-3' onSubmit={handleSubmit}>
                  <label className='block'>
                    <span className='mb-1 block text-sm font-semibold text-[#333333]'>
                      {content.fullNameLabel}
                    </span>
                    <input
                      type='text'
                      required
                      value={fullName}
                      onChange={(event) => {
                        setFullName(event.target.value);
                      }}
                      className='es-focus-ring w-full rounded-[14px] border border-[#CAD6E5] bg-white px-4 py-3 text-[16px] font-semibold'
                    />
                  </label>
                  <label className='block'>
                    <span className='mb-1 block text-sm font-semibold text-[#333333]'>
                      {content.emailLabel}
                    </span>
                    <input
                      type='email'
                      required
                      value={email}
                      onChange={(event) => {
                        setEmail(event.target.value);
                      }}
                      className='es-focus-ring w-full rounded-[14px] border border-[#CAD6E5] bg-white px-4 py-3 text-[16px] font-semibold'
                    />
                  </label>
                  <label className='block'>
                    <span className='mb-1 block text-sm font-semibold text-[#333333]'>
                      {content.phoneLabel}
                    </span>
                    <input
                      type='tel'
                      required
                      value={phone}
                      onChange={(event) => {
                        setPhone(event.target.value);
                      }}
                      className='es-focus-ring w-full rounded-[14px] border border-[#CAD6E5] bg-white px-4 py-3 text-[16px] font-semibold'
                    />
                  </label>

                  <div className='grid grid-cols-[1fr_auto] gap-2'>
                    <label>
                      <span className='mb-1 block text-sm font-semibold text-[#333333]'>
                        {content.discountCodeLabel}
                      </span>
                      <input
                        type='text'
                        value={discountCode}
                        onChange={(event) => {
                          setDiscountCode(event.target.value);
                          setDiscountError('');
                        }}
                        placeholder={content.discountCodePlaceholder}
                        className='es-focus-ring w-full rounded-[14px] border border-[#CAD6E5] bg-white px-4 py-3 text-[16px] font-semibold'
                      />
                    </label>
                    <button
                      type='button'
                      onClick={handleApplyDiscount}
                      disabled={isDiscountRulesLoading}
                      className='es-focus-ring mt-6 inline-flex h-[50px] items-center justify-center rounded-[10px] border border-[#C84A16] px-4 text-sm font-semibold text-[#C84A16] disabled:cursor-not-allowed disabled:opacity-60'
                    >
                      {content.applyDiscountLabel}
                    </button>
                  </div>

                  {discountRule && (
                    <DiscountBadge label={content.discountAppliedLabel} />
                  )}
                  {discountError && (
                    <p className='text-sm font-semibold text-[#B23535]'>
                      {discountError}
                    </p>
                  )}

                  <div className='rounded-[12px] border border-[#CAD6E5] bg-white px-4 py-3'>
                    <p className='text-sm text-[#5A5A5A]'>
                      {content.paymentMethodLabel}
                    </p>
                    <p className='font-semibold text-[#333333]'>
                      {content.paymentMethodValue}
                    </p>
                  </div>

                  <div className='rounded-[14px] border border-[#CAD6E5] bg-[#F1F6FC] p-4'>
                    <QrPlaceholder label={content.qrLabel} />
                    <p className='mt-3 text-center text-[20px] font-semibold leading-none text-[#333333]'>
                      {formatCurrencyHkd(totalAmount)}
                    </p>
                  </div>

                  <button
                    type='submit'
                    className='es-focus-ring es-cta-button es-cta-primary mt-1 h-[56px] w-full rounded-[10px] text-base font-semibold'
                  >
                    {content.submitLabel}
                  </button>
                </form>
              </section>
            </div>
          </div>

          <div className='pt-4'>
            <p className='text-center text-[16px] font-medium leading-7 text-[#333333]'>
              {content.copyright}
            </p>
          </div>
        </div>
      </section>
    </ModalOverlay>
  );
}

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
            src='/images/my-best-auntie-booking/thank-you-modal-tree.png'
            alt=''
            width={1488}
            height={855}
            className='pointer-events-none absolute left-1/2 top-0 hidden w-[800px] -translate-x-1/2 -translate-y-[120px] lg:block'
            aria-hidden='true'
          />
          <Image
            src='/images/my-best-auntie-booking/flying-chip.png'
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
              src='/images/my-best-auntie-booking/seat-tree.png'
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
                      <Image
                        src='/images/my-best-auntie-booking/date-cal.png'
                        alt=''
                        width={24}
                        height={24}
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

          <div className='border-t border-black/10 pt-6 lg:mt-[70px]'>
            <p className='text-center text-[16px] font-medium leading-7 text-[#333333]'>
              © {new Date().getFullYear()} Evolve Sprouts
            </p>
          </div>
        </div>
      </section>
    </ModalOverlay>
  );
}
