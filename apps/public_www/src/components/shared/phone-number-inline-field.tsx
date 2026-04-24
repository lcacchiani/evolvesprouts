'use client';

import { formatContentTemplate } from '@/content/content-field-utils';
import { PHONE_COUNTRIES } from '@/lib/phone-countries.generated';
import { useEffect, useMemo, useRef } from 'react';

type PhoneCountryRow = (typeof PHONE_COUNTRIES)[number];

/** Generated countries plus optional synthetic drift row for unknown regions. */
type CompactSelectRow =
  | PhoneCountryRow
  | { region: string; dialCode: string; englishName: string };

function buildDedupedByDialCodePreferredOrder(): PhoneCountryRow[] {
  const seenDial = new Set<string>();
  const out: PhoneCountryRow[] = [];
  for (const row of PHONE_COUNTRIES) {
    if (seenDial.has(row.dialCode)) {
      continue;
    }
    seenDial.add(row.dialCode);
    out.push(row);
  }
  return out;
}

const DEDUPED_PHONE_COUNTRIES = buildDedupedByDialCodePreferredOrder();

const hkPinnedCandidate = DEDUPED_PHONE_COUNTRIES.find((r) => r.dialCode === '852');
if (!hkPinnedCandidate) {
  throw new Error('PHONE_COUNTRIES must include Hong Kong (+852)');
}
const HK_PINNED_ROW: PhoneCountryRow = hkPinnedCandidate;

function buildInlinePhoneSelectRows(): PhoneCountryRow[] {
  const rest = DEDUPED_PHONE_COUNTRIES.filter((r) => r.dialCode !== '852');
  rest.sort((a, b) =>
    a.dialCode.localeCompare(b.dialCode, undefined, { numeric: false, sensitivity: 'base' }),
  );
  return [HK_PINNED_ROW, ...rest];
}

/** Preferred-order dedupe, +852 (HK) pinned first, remaining rows sorted by dial code string. */
const INLINE_PHONE_SELECT_ROWS = buildInlinePhoneSelectRows();

/** All options after the pinned HK row (same order as in `INLINE_PHONE_SELECT_ROWS`). */
const INLINE_PHONE_SELECT_TAIL = INLINE_PHONE_SELECT_ROWS.slice(1);

const INLINE_OPTION_REGIONS = new Set<string>(INLINE_PHONE_SELECT_ROWS.map((r) => r.region));

const DIAL_TO_CANONICAL_REGION = new Map<string, string>();
for (const row of INLINE_PHONE_SELECT_ROWS) {
  if (!DIAL_TO_CANONICAL_REGION.has(row.dialCode)) {
    DIAL_TO_CANONICAL_REGION.set(row.dialCode, row.region);
  }
}

function buildSelectRows(phoneCountry: string): CompactSelectRow[] {
  if (!phoneCountry || INLINE_OPTION_REGIONS.has(phoneCountry)) {
    return INLINE_PHONE_SELECT_ROWS;
  }
  const direct = PHONE_COUNTRIES.find((r) => r.region === phoneCountry);
  if (direct) {
    return INLINE_PHONE_SELECT_ROWS;
  }
  if (typeof console !== 'undefined' && console.warn) {
    console.warn(
      'PhoneNumberInlineField: unknown phone_country not found in PHONE_COUNTRIES',
      phoneCountry,
    );
  }
  const driftRow: CompactSelectRow = { region: phoneCountry, dialCode: '', englishName: phoneCountry };
  return [HK_PINNED_ROW, driftRow, ...INLINE_PHONE_SELECT_TAIL];
}

function resolveSelectValue(phoneCountry: string): string {
  if (!phoneCountry) {
    return HK_PINNED_ROW.region;
  }
  if (INLINE_OPTION_REGIONS.has(phoneCountry)) {
    return phoneCountry;
  }
  const direct = PHONE_COUNTRIES.find((r) => r.region === phoneCountry);
  if (direct) {
    return DIAL_TO_CANONICAL_REGION.get(direct.dialCode) ?? direct.region;
  }
  return phoneCountry;
}

export interface PhoneNumberInlineFieldProps {
  /** Optional id on the region `<select>` (for tests and programmatic association). */
  countrySelectId?: string;
  /** When set, the national input uses `aria-labelledby` (avoids duplicate names when a parent `<label>` would wrap both controls). */
  nationalInputAriaLabelledBy?: string;
  phoneCountry: string;
  phone: string;
  onPhoneCountryChange: (region: string) => void;
  onPhoneChange: (value: string) => void;
  onPhoneBlur?: () => void;
  countryAriaLabel: string;
  dialCodeOptionTemplate: string;
  hasError: boolean;
  errorMessageId?: string;
  inputId: string;
  autoComplete: string;
  required?: boolean;
}

export function PhoneNumberInlineField({
  countrySelectId,
  nationalInputAriaLabelledBy,
  phoneCountry,
  phone,
  onPhoneCountryChange,
  onPhoneChange,
  onPhoneBlur,
  countryAriaLabel,
  dialCodeOptionTemplate,
  hasError,
  errorMessageId,
  inputId,
  autoComplete,
  required = false,
}: PhoneNumberInlineFieldProps) {
  const groupClassName = `es-phone-inline-group${hasError ? ' is-error' : ''}`;

  const selectRows = useMemo(() => buildSelectRows(phoneCountry), [phoneCountry]);
  const selectValue = useMemo(() => resolveSelectValue(phoneCountry), [phoneCountry]);

  const canonicalSyncKeyRef = useRef<string | null>(null);
  useEffect(() => {
    const canonical = resolveSelectValue(phoneCountry);
    if (canonical === phoneCountry) {
      canonicalSyncKeyRef.current = null;
      return;
    }
    if (!INLINE_OPTION_REGIONS.has(canonical)) {
      return;
    }
    const syncKey = `${phoneCountry}->${canonical}`;
    if (canonicalSyncKeyRef.current === syncKey) {
      return;
    }
    canonicalSyncKeyRef.current = syncKey;
    onPhoneCountryChange(canonical);
  }, [phoneCountry, onPhoneCountryChange]);

  return (
    <div className={groupClassName}>
      <select
        id={countrySelectId}
        className='es-focus-ring es-phone-inline-dial es-form-input'
        value={selectValue}
        onChange={(event) => {
          onPhoneCountryChange(event.target.value);
        }}
        aria-label={countryAriaLabel}
      >
        {selectRows.map((row) => {
          const isDriftSynthetic =
            row.dialCode === '' && !PHONE_COUNTRIES.some((p) => p.region === row.region);
          const label = isDriftSynthetic
            ? row.region
            : formatContentTemplate(dialCodeOptionTemplate, { dialCode: row.dialCode });
          return (
            <option key={`${row.region}-${row.dialCode}`} value={row.region} title={row.englishName}>
              {label}
            </option>
          );
        })}
      </select>
      <input
        id={inputId}
        type='tel'
        inputMode='tel'
        autoComplete={autoComplete}
        required={required}
        value={phone}
        onChange={(event) => {
          onPhoneChange(event.target.value);
        }}
        onBlur={onPhoneBlur}
        className='es-focus-ring es-phone-inline-national es-form-input'
        {...(nationalInputAriaLabelledBy
          ? { 'aria-labelledby': nationalInputAriaLabelledBy }
          : {})}
        aria-invalid={hasError}
        aria-describedby={hasError ? errorMessageId : undefined}
      />
    </div>
  );
}
