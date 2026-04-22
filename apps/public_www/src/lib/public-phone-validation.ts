import type { CountryCode } from 'libphonenumber-js';
import { parsePhoneNumberFromString } from 'libphonenumber-js';

export function isValidPhoneForRegion(nationalInput: string, region: string): boolean {
  const digits = nationalInput.replace(/\D/g, '');
  if (!digits.trim()) {
    return false;
  }
  const parsed = parsePhoneNumberFromString(digits, region as CountryCode);
  return parsed !== undefined && parsed.isValid();
}
