/** Build API `phone_region` + `phone_number` (digits) from editor state; null clears phone. */
export function contactPhoneRequestFields(
  region: string,
  nationalInput: string
): { phone_region: string | null; phone_number: string | null } {
  const national = nationalInput.replace(/\D/g, '');
  if (!national) {
    return { phone_region: null, phone_number: null };
  }
  return { phone_region: region, phone_number: national };
}
