const DEFAULT_FRANKFURTER_API_ORIGIN = 'https://api.frankfurter.dev';

function frankfurterApiOrigin(): string {
  const fromEnv = process.env.NEXT_PUBLIC_FRANKFURTER_API_ORIGIN?.trim();
  if (fromEnv) {
    try {
      const url = new URL(fromEnv);
      if (url.protocol === 'https:' || url.protocol === 'http:') {
        return url.origin;
      }
    } catch {
      // fall through
    }
  }
  return DEFAULT_FRANKFURTER_API_ORIGIN;
}

type FrankfurterRateRow = {
  base?: string;
  quote?: string;
  rate?: number;
};

function isFrankfurterRateRow(value: unknown): value is FrankfurterRateRow {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as FrankfurterRateRow).rate === 'number' &&
    Number.isFinite((value as FrankfurterRateRow).rate)
  );
}

const rateToHkdCache = new Map<string, Promise<number>>();

/**
 * Returns the multiplier to convert `amount` in `currency` to HKD: `amount * rate === HKD`.
 */
export function getHkdMultiplier(currency: string): Promise<number> {
  const code = currency.trim().toUpperCase();
  if (!code || code === 'HKD') {
    return Promise.resolve(1);
  }

  const cached = rateToHkdCache.get(code);
  if (cached) {
    return cached;
  }

  const request = (async () => {
    const origin = frankfurterApiOrigin();
    const url = `${origin}/v2/rates?base=${encodeURIComponent(code)}&quotes=HKD`;
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Frankfurter request failed (${response.status}).`);
    }
    const data: unknown = await response.json();
    if (!Array.isArray(data) || data.length === 0 || !isFrankfurterRateRow(data[0])) {
      throw new Error('Unexpected Frankfurter response shape.');
    }
    return data[0].rate;
  })();

  rateToHkdCache.set(code, request);
  return request;
}

export function clearFrankfurterRateCacheForTests(): void {
  rateToHkdCache.clear();
}
