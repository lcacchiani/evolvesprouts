type UnknownObject = { [key: string]: unknown };

export function readOptionalText(value: unknown): string | undefined {
  if (typeof value !== 'string') {
    return undefined;
  }

  const normalized = value.trim();
  return normalized.length > 0 ? normalized : undefined;
}

function isUnknownObject(value: unknown): value is UnknownObject {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

export function toRecord(value: unknown): UnknownObject | null {
  if (!isUnknownObject(value)) {
    return null;
  }

  return value;
}

export function readCandidateText(
  record: UnknownObject,
  keys: readonly string[],
): string | undefined {
  for (const key of keys) {
    const candidate = readOptionalText(record[key]);
    if (candidate) {
      return candidate;
    }
  }

  return undefined;
}

export function readCandidateTextFromUnknown(
  value: unknown,
  keys: readonly string[],
): string | undefined {
  const record = toRecord(value);
  if (!record) {
    return undefined;
  }

  return readCandidateText(record, keys);
}

export function readStringUnion<T extends readonly string[]>(
  value: unknown,
  values: T,
): T[number] | undefined {
  if (typeof value !== 'string') {
    return undefined;
  }

  const normalized = value.trim().toLowerCase();
  if (!normalized) {
    return undefined;
  }

  return values.find((entry) => entry === normalized) as T[number] | undefined;
}
