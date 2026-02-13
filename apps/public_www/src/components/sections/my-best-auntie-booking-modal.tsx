'use client';

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

export interface ReservationSummary {
  attendeeName: string;
  attendeeEmail: string;
  attendeePhone: string;
  packageLabel: string;
  monthLabel: string;
  paymentMethod: string;
  totalAmount: number;
  courseLabel: string;
}

interface MyBestAuntieBookingModalProps {
  content: MyBestAuntieBookingContent['paymentModal'];
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

type DiscountRule = MyBestAuntieBookingContent['paymentModal']['discountCodes'][number];

const MODAL_PANEL_BACKGROUND = '#FFFFFF';
const MODAL_OVERLAY_BACKGROUND = 'rgba(16, 14, 11, 0.6)';
const HEADING_TEXT_COLOR =
  'var(--figma-colors-join-our-sprouts-squad-community, #333333)';
const BODY_TEXT_COLOR = 'var(--figma-colors-home, #4A4A4A)';
const CHROME_BACKGROUND = '#FFF7F1';
const CHROME_BORDER = '#EECAB0';

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

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('en-HK', {
    style: 'currency',
    currency: 'HKD',
    maximumFractionDigits: 0,
  }).format(value);
}

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
    <div className='fixed inset-0 z-[80]'>
      <button
        type='button'
        aria-label='Close modal'
        className='absolute inset-0'
        style={{ backgroundColor: MODAL_OVERLAY_BACKGROUND }}
        onClick={onClose}
      />
      <div className='relative z-10 flex min-h-full items-center justify-center p-4 sm:p-6'>
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
      className='es-focus-ring inline-flex h-10 w-10 items-center justify-center rounded-full border border-black/20 bg-white text-black/80'
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
    <div className='w-full max-w-[240px] rounded-2xl border border-[#D9C3B0] bg-white p-4 text-center'>
      <div className='mx-auto grid h-[160px] w-[160px] grid-cols-5 gap-1 rounded-lg bg-[#FFF7F1] p-2'>
        {Array.from({ length: 25 }).map((_, index) => (
          <span
            key={index}
            className={`rounded-[3px] ${index % 2 === 0 ? 'bg-black' : 'bg-transparent'}`}
          />
        ))}
      </div>
      <p className='mt-3 text-sm font-semibold text-[#4A4A4A]'>{label}</p>
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

export function MyBestAuntieBookingModal({
  content,
  onClose,
  onSubmitReservation,
}: MyBestAuntieBookingModalProps) {
  const firstMonthId = content.monthOptions[0]?.id ?? '';
  const firstPackageId = content.packageOptions[0]?.id ?? '';
  const [selectedMonthId, setSelectedMonthId] = useState(firstMonthId);
  const [selectedPackageId, setSelectedPackageId] = useState(firstPackageId);
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [discountCode, setDiscountCode] = useState('');
  const [discountRule, setDiscountRule] = useState<DiscountRule | null>(null);
  const [discountError, setDiscountError] = useState('');

  useEffect(() => {
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    function handleEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        onClose();
      }
    }

    window.addEventListener('keydown', handleEscape);

    return () => {
      document.body.style.overflow = originalOverflow;
      window.removeEventListener('keydown', handleEscape);
    };
  }, [onClose]);

  const selectedMonth =
    content.monthOptions.find((option) => option.id === selectedMonthId) ??
    content.monthOptions[0];
  const selectedPackage =
    content.packageOptions.find((option) => option.id === selectedPackageId) ??
    content.packageOptions[0];

  const totalAmount = useMemo(() => {
    return applyDiscount(selectedPackage?.price ?? 0, discountRule);
  }, [discountRule, selectedPackage?.price]);

  const activePartRows = useMemo(() => {
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

  function handleApplyDiscount() {
    const normalizedCode = discountCode.trim().toUpperCase();
    if (!normalizedCode) {
      setDiscountRule(null);
      setDiscountError(content.invalidDiscountLabel);
      return;
    }

    const matchedRule = content.discountCodes.find(
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
      packageLabel: selectedPackage.label,
      monthLabel: selectedMonth.label,
      paymentMethod: content.paymentMethodValue,
      totalAmount,
      courseLabel: content.title,
    });
  }

  return (
    <ModalOverlay onClose={onClose}>
      <section
        role='dialog'
        aria-modal='true'
        aria-label={content.title}
        className='relative w-full max-w-[1120px] overflow-hidden rounded-[24px] border border-black/10 shadow-[0_22px_70px_rgba(0,0,0,0.42)]'
        style={{ backgroundColor: MODAL_PANEL_BACKGROUND }}
      >
        <header className='flex items-start justify-between gap-4 border-b border-[#ECD8C7] bg-[#FFF7F1] px-5 py-4 sm:px-7'>
          <div>
            <p className='text-sm font-semibold text-[#5A5A5A]'>
              {content.thankYouLead}
            </p>
            <h2 className='mt-1 text-[clamp(1.2rem,2vw,1.8rem)]' style={headingStyle}>
              {content.title}
            </h2>
          </div>
          <CloseButton label={content.closeLabel} onClose={onClose} />
        </header>

        <div className='grid max-h-[82vh] gap-0 overflow-y-auto lg:grid-cols-[1.1fr_0.9fr]'>
          <div className='space-y-6 border-b border-[#ECD8C7] px-5 py-6 sm:px-7 lg:border-b-0 lg:border-r'>
            <section className='rounded-2xl border border-[#ECD8C7] bg-[#FFF9F4] p-4 sm:p-5'>
              <h3 className='text-lg font-semibold text-[#333333]'>
                {content.courseScheduleTitle}
              </h3>
              <ul className='mt-4 space-y-3'>
                {activePartRows.map((part) => (
                  <li
                    key={part.label}
                    className='rounded-xl border border-[#ECD8C7] bg-white px-4 py-3'
                  >
                    <p className='text-sm font-semibold text-[#C84A16]'>{part.label}</p>
                    <p className='mt-1 text-sm font-semibold text-[#333333]'>
                      {part.date}
                    </p>
                    <p className='mt-1 text-sm text-[#4A4A4A]'>{part.description}</p>
                  </li>
                ))}
              </ul>
            </section>

            <section className='rounded-2xl border border-[#ECD8C7] bg-[#FFF9F4] p-4 sm:p-5'>
              <h3 className='text-lg font-semibold text-[#333333]'>
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
                      className='es-focus-ring rounded-full px-4 py-2 text-sm font-semibold'
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
            </section>

            <section className='rounded-2xl border border-[#ECD8C7] bg-[#FFF9F4] p-4 sm:p-5'>
              <h3 className='text-lg font-semibold text-[#333333]'>
                {content.packageLabel}
              </h3>
              <ul className='mt-3 space-y-3'>
                {content.packageOptions.map((option) => {
                  const isActive = option.id === selectedPackageId;
                  return (
                    <li key={option.id}>
                      <button
                        type='button'
                        onClick={() => {
                          setSelectedPackageId(option.id);
                        }}
                        className='es-focus-ring w-full rounded-xl px-4 py-3 text-left'
                        style={{
                          border: `1px solid ${isActive ? '#C84A16' : CHROME_BORDER}`,
                          backgroundColor: isActive ? '#FFF0E5' : '#FFFFFF',
                        }}
                      >
                        <div className='flex items-center justify-between gap-3'>
                          <p className='font-semibold text-[#333333]'>{option.label}</p>
                          <p className='font-semibold text-[#333333]'>
                            {formatCurrency(option.price)}
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
          </div>

          <div className='px-5 py-6 sm:px-7'>
            <section className='rounded-2xl border border-[#ECD8C7] bg-[#FFF9F4] p-4 sm:p-5'>
              <h3 className='text-lg font-semibold text-[#333333]'>
                {content.pricingTitle}
              </h3>
              <div className='mt-3 rounded-xl border border-[#ECD8C7] bg-white px-4 py-3'>
                <p className='text-sm text-[#5A5A5A]'>{content.totalAmountLabel}</p>
                <p className='mt-1 text-[1.6rem] font-semibold text-[#333333]'>
                  {formatCurrency(totalAmount)}
                </p>
                <p className='mt-1 text-xs text-[#5A5A5A]'>{content.refundHint}</p>
              </div>
            </section>

            <section className='mt-4 rounded-2xl border border-[#ECD8C7] bg-[#FFF9F4] p-4 sm:p-5'>
              <h3 className='text-lg font-semibold text-[#333333]'>
                {content.locationTitle}
              </h3>
              <p className='mt-2 font-semibold text-[#333333]'>{content.locationName}</p>
              <p className='mt-1 text-sm text-[#4A4A4A]'>{content.locationAddress}</p>
              <a
                href={content.directionHref}
                target='_blank'
                rel='noopener noreferrer'
                className='mt-3 inline-flex text-sm font-semibold text-[#C84A16] underline underline-offset-2'
              >
                {content.directionLabel}
              </a>
            </section>

            <section className='mt-4 rounded-2xl border border-[#ECD8C7] bg-[#FFF9F4] p-4 sm:p-5'>
              <h3 className='text-lg font-semibold text-[#333333]'>
                {content.reservationTitle}
              </h3>
              <p className='mt-1 text-sm text-[#4A4A4A]'>
                {content.reservationDescription}
              </p>

              <form className='mt-4 space-y-3' onSubmit={handleSubmit}>
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
                    className='es-focus-ring w-full rounded-xl border border-[#DFC5B2] bg-white px-3 py-2 text-sm'
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
                    className='es-focus-ring w-full rounded-xl border border-[#DFC5B2] bg-white px-3 py-2 text-sm'
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
                    className='es-focus-ring w-full rounded-xl border border-[#DFC5B2] bg-white px-3 py-2 text-sm'
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
                      className='es-focus-ring w-full rounded-xl border border-[#DFC5B2] bg-white px-3 py-2 text-sm'
                    />
                  </label>
                  <button
                    type='button'
                    onClick={handleApplyDiscount}
                    className='es-focus-ring mt-6 inline-flex h-10 items-center justify-center rounded-xl border border-[#C84A16] px-3 text-sm font-semibold text-[#C84A16]'
                  >
                    {content.applyDiscountLabel}
                  </button>
                </div>

                {discountRule && (
                  <DiscountBadge label={content.discountAppliedLabel} />
                )}
                {discountError && (
                  <p className='text-sm font-semibold text-[#B23535]'>{discountError}</p>
                )}

                <div className='rounded-xl border border-[#ECD8C7] bg-white p-3'>
                  <p className='text-sm text-[#5A5A5A]'>{content.paymentMethodLabel}</p>
                  <p className='font-semibold text-[#333333]'>
                    {content.paymentMethodValue}
                  </p>
                </div>

                <QrPlaceholder label={content.qrLabel} />

                <button
                  type='submit'
                  className='es-focus-ring es-cta-button es-cta-primary h-[52px] w-full rounded-[10px] text-base font-semibold'
                >
                  {content.submitLabel}
                </button>
              </form>
            </section>
            <p className='mt-3 text-center text-xs text-[#6D6A67]'>{content.copyright}</p>
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
  useEffect(() => {
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    function handleEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        onClose();
      }
    }

    window.addEventListener('keydown', handleEscape);

    return () => {
      document.body.style.overflow = originalOverflow;
      window.removeEventListener('keydown', handleEscape);
    };
  }, [onClose]);

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
              <strong>${escapeHtml(formatCurrency(summary.totalAmount))}</strong>
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
        className='relative w-full max-w-[760px] overflow-hidden rounded-[24px] border border-black/10 shadow-[0_22px_70px_rgba(0,0,0,0.42)]'
        style={{ backgroundColor: MODAL_PANEL_BACKGROUND }}
      >
        <header className='flex items-center justify-between gap-4 border-b border-[#ECD8C7] bg-[#FFF7F1] px-5 py-4 sm:px-7'>
          <h2 className='text-[clamp(1.1rem,2vw,1.6rem)]' style={headingStyle}>
            {content.successLabel}
          </h2>
          <CloseButton label={content.closeLabel} onClose={onClose} />
        </header>

        <div className='space-y-5 px-5 py-6 sm:px-7'>
          <div className='rounded-2xl border border-[#DDEBD8] bg-[#F4FFF2] px-4 py-4'>
            <p className='text-sm font-semibold text-[#2D7B3D]'>{content.successLabel}</p>
            <h3 className='mt-1 text-[clamp(1.05rem,1.8vw,1.4rem)]' style={headingStyle}>
              {content.title}
            </h3>
            <p className='mt-2 text-sm text-[#4A4A4A]' style={bodyStyle}>
              {content.subtitle}{' '}
              <span className='font-semibold'>
                {summary?.attendeeEmail ?? content.noEmailFallback}
              </span>
            </p>
          </div>

          <div className='rounded-2xl border border-[#ECD8C7] bg-[#FFF9F4] p-4'>
            <h4 className='font-semibold text-[#333333]'>{content.courseLabel}</h4>
            <p className='mt-1 text-sm text-[#5A5A5A]'>{summary?.monthLabel ?? ''}</p>

            <dl className='mt-4 space-y-2 text-sm'>
              <div className='flex items-center justify-between gap-2'>
                <dt className='text-[#5A5A5A]'>{content.transactionDateLabel}</dt>
                <dd className='font-semibold text-[#333333]'>{transactionDate}</dd>
              </div>
              <div className='flex items-center justify-between gap-2'>
                <dt className='text-[#5A5A5A]'>{content.paymentMethodLabel}</dt>
                <dd className='font-semibold text-[#333333]'>
                  {summary?.paymentMethod ?? ''}
                </dd>
              </div>
              <div className='flex items-center justify-between gap-2'>
                <dt className='text-[#5A5A5A]'>{content.totalLabel}</dt>
                <dd className='font-semibold text-[#333333]'>
                  {formatCurrency(summary?.totalAmount ?? 0)}
                </dd>
              </div>
            </dl>
          </div>

          <div className='flex flex-col gap-2 sm:flex-row'>
            <button
              type='button'
              onClick={handlePrint}
              className='es-focus-ring inline-flex h-11 flex-1 items-center justify-center rounded-[10px] border border-[#ED622E] bg-white px-4 text-sm font-semibold text-[#ED622E]'
            >
              {content.printLabel}
            </button>
            <Link
              href={homeHref}
              className='es-focus-ring es-cta-button es-cta-primary inline-flex h-11 flex-1 items-center justify-center rounded-[10px] px-4 text-sm font-semibold'
            >
              {content.backHomeLabel}
            </Link>
          </div>
        </div>
      </section>
    </ModalOverlay>
  );
}
