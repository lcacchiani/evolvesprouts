import { toRecord } from '@/content/content-field-utils';
import { type CrmApiClient, buildCrmApiUrl } from '@/lib/crm-api-client';

export interface DiscountRule {
  code: string;
  type: 'percent' | 'amount';
  value: number;
  name?: string;
  currencyCode?: string | null;
  currencySymbol?: string | null;
}

export const DISCOUNT_VALIDATE_API_PATH = '/v1/discounts/validate';

function readRequiredText(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null;
  }

  const normalizedText = value.trim();
  if (!normalizedText) {
    return null;
  }

  return normalizedText;
}

function readNumericAmount(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === 'string') {
    const parsed = Number.parseFloat(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  return null;
}

function normalizeApiDiscount(
  value: unknown,
  fallbackCode: string,
): DiscountRule | null {
  const record = toRecord(value);
  if (!record) {
    return null;
  }

  const code = readRequiredText(record.code) ?? fallbackCode;
  const amount = readNumericAmount(record.amount);
  const isPercentage = record.is_percentage;

  if (!code || amount === null || typeof isPercentage !== 'boolean') {
    return null;
  }

  const name = readRequiredText(record.name);
  const currencyCode =
    typeof record.currency_code === 'string' || record.currency_code === null
      ? record.currency_code
      : null;
  const currencySymbol =
    typeof record.currency_symbol === 'string' || record.currency_symbol === null
      ? record.currency_symbol
      : null;

  return {
    code,
    name: name ?? undefined,
    type: isPercentage ? 'percent' : 'amount',
    value: amount,
    currencyCode,
    currencySymbol,
  };
}

export function normalizeDiscountValidationPayload(
  payload: unknown,
  requestedCode: string,
): DiscountRule | null {
  const normalizedRequestedCode = readRequiredText(requestedCode) ?? '';
  if (!normalizedRequestedCode) {
    return null;
  }
  if (Array.isArray(payload)) {
    return (
      payload
        .map((entry) => normalizeApiDiscount(entry, normalizedRequestedCode))
        .find((entry): entry is DiscountRule => entry !== null) ?? null
    );
  }
  const record = toRecord(payload);
  if (!record) {
    return null;
  }
  if (record.is_valid === false || record.valid === false) {
    return null;
  }

  const nestedData = record.data;
  if (Array.isArray(nestedData)) {
    return (
      nestedData
        .map((entry) => normalizeApiDiscount(entry, normalizedRequestedCode))
        .find((entry): entry is DiscountRule => entry !== null) ?? null
    );
  }

  if (nestedData) {
    const nestedDiscount = normalizeApiDiscount(
      nestedData,
      normalizedRequestedCode,
    );
    if (nestedDiscount) {
      return nestedDiscount;
    }
  }

  const nestedDiscount = normalizeApiDiscount(
    record.discount,
    normalizedRequestedCode,
  );
  if (nestedDiscount) {
    return nestedDiscount;
  }

  return normalizeApiDiscount(record, normalizedRequestedCode);
}

export function buildDiscountValidationApiUrl(crmApiBaseUrl: string): string {
  return buildCrmApiUrl(crmApiBaseUrl, DISCOUNT_VALIDATE_API_PATH);
}

export async function validateDiscountCode(
  crmApiClient: CrmApiClient,
  code: string,
  signal?: AbortSignal,
): Promise<DiscountRule | null> {
  const normalizedCode = readRequiredText(code);
  if (!normalizedCode) {
    return null;
  }

  const payload = await crmApiClient.request({
    endpointPath: DISCOUNT_VALIDATE_API_PATH,
    method: 'POST',
    body: {
      code: normalizedCode,
    },
    signal,
    expectedSuccessStatuses: [200, 202],
  });

  return normalizeDiscountValidationPayload(payload, normalizedCode);
}
