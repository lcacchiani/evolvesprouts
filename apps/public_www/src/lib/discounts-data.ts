import { type CrmApiClient, buildCrmApiUrl } from '@/lib/crm-api-client';

export interface DiscountRule {
  code: string;
  type: 'percent' | 'amount';
  value: number;
  name?: string;
  currencyCode?: string | null;
  currencySymbol?: string | null;
}

interface StaticDiscountRule {
  code: unknown;
  type: unknown;
  value: unknown;
}

export const DISCOUNTS_API_PATH = '/v1/discounts';

function toRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }

  return value as Record<string, unknown>;
}

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

function normalizeApiDiscount(value: unknown): DiscountRule | null {
  const record = toRecord(value);
  if (!record) {
    return null;
  }

  const code = readRequiredText(record.code);
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

export function normalizeStaticDiscountRules(
  rules: ReadonlyArray<StaticDiscountRule>,
): DiscountRule[] {
  return rules
    .map((rule) => {
      const code = readRequiredText(rule.code);
      const amount = readNumericAmount(rule.value);
      const discountType = rule.type;

      if (
        !code ||
        amount === null ||
        (discountType !== 'percent' && discountType !== 'amount')
      ) {
        return null;
      }

      return {
        code,
        type: discountType,
        value: amount,
      } satisfies DiscountRule;
    })
    .filter((rule): rule is DiscountRule => rule !== null);
}

export function normalizeDiscountsPayload(payload: unknown): DiscountRule[] {
  if (Array.isArray(payload)) {
    return payload
      .map((entry) => normalizeApiDiscount(entry))
      .filter((entry): entry is DiscountRule => entry !== null);
  }

  const record = toRecord(payload);
  if (!record) {
    return [];
  }

  const nestedData = Array.isArray(record.data) ? record.data : [];
  return nestedData
    .map((entry) => normalizeApiDiscount(entry))
    .filter((entry): entry is DiscountRule => entry !== null);
}

export function buildDiscountsApiUrl(crmApiBaseUrl: string): string {
  return buildCrmApiUrl(crmApiBaseUrl, DISCOUNTS_API_PATH);
}

export async function fetchDiscountRules(
  crmApiClient: CrmApiClient,
  signal: AbortSignal,
): Promise<DiscountRule[]> {
  const payload = await crmApiClient.request({
    endpointPath: DISCOUNTS_API_PATH,
    method: 'GET',
    signal,
  });
  return normalizeDiscountsPayload(payload);
}
