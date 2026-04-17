'use client';

type AdminReferralQrEvent =
  | 'admin_referral_qr_opened'
  | 'admin_referral_qr_copied'
  | 'admin_referral_qr_downloaded';

/**
 * Minimal admin-side analytics hook for referral QR tooling.
 * No-op outside production instrumentation (broader admin analytics is out of scope).
 */
export function trackAdminAnalyticsEvent(
  _event: AdminReferralQrEvent,
  _params?: Record<string, string | number | boolean | null | undefined>,
): void {
  void _event;
  void _params;
  if (process.env.NODE_ENV === 'development') {
    return;
  }
}
