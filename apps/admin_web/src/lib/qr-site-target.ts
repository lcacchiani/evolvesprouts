export type QrSiteTarget = 'public_www' | 'training';

export const QR_SITE_TARGET_OPTIONS: readonly { value: QrSiteTarget; label: string }[] = [
  { value: 'public_www', label: 'Public website (www)' },
  { value: 'training', label: 'Training site' },
] as const;
