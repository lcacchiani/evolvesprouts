# Public WWW Analytics Change Log

Use this log for every analytics-impacting Public WWW change.

## Required fields per entry

- Date (UTC)
- PR/branch reference
- Public WWW code changes
- GA4 updates (custom definitions/key events)
- GTM updates (workspace/container/version status)
- Documentation updates

## Entries

| Date (UTC) | Ref | Public WWW changes | GA4 updates | GTM updates | Documentation updates |
|---|---|---|---|---|---|
| 2026-03-20 | `cursor/thank-you-modal-cards-f80f` | Booking thank-you modal: removed calendar (.ics) download CTA and `booking_thank_you_ics_download` from `apps/public_www/src/lib/analytics-taxonomy.json` / `trackAnalyticsEvent` usage. | Retire/stop using `booking_thank_you_ics_download` in GA4 reporting if it was registered. | Remove or disable GTM mapping for `booking_thank_you_ics_download` if present. | Updated `docs/architecture/analytics-ga4-gtm-runbook.md` and `docs/architecture/marketing-stack.md`. |
| 2026-03-20 | `cursor/thank-you-modal-content-a5ea` | Booking thank-you modal: removed `booking_receipt_print_click`; added `booking_thank_you_ics_download` in `apps/public_www/src/lib/analytics-taxonomy.json` and `trackAnalyticsEvent` on calendar (.ics) download in `thank-you-modal.tsx`. | Add/verify GA4 event + params `cohort_date`, `total_amount`. Retire `booking_receipt_print_click` in GA4 if it was registered. | Add/verify GTM custom-event trigger + GA4 tag for `booking_thank_you_ics_download`; remove print-event mapping if present. | Updated `docs/architecture/analytics-ga4-gtm-runbook.md` and `docs/architecture/marketing-stack.md`. |
| 2026-03-18 | `cursor/landing-page-organization-plan-506a` | Added `landing_page_cta_click` to `apps/public_www/src/lib/analytics-taxonomy.json` and instrumented landing-page CTA tracking in the new reusable landing-page flow. | Add/verify event-scoped custom dimension `landing_page_slug`. No new key events required. | Add/verify GTM custom-event trigger + GA4 event tag mapping for `landing_page_cta_click` with `landing_page_slug`, `age_group`, and `cohort_label` params. | Updated `docs/architecture/analytics-ga4-gtm-runbook.md` event catalog and GA4/GTM setup guidance for landing-page analytics. |
| 2026-03-14 | `cursor/ga4-api-access-verification-f10c` | Added shared `trackAnalyticsEvent` instrumentation for contact/media/community/booking/WhatsApp flows. | Created event-scoped custom dimensions, custom metrics (`total_amount`, `discount_amount`), and key events (`contact_form_submit_success`, `media_form_submit_success`, `community_signup_submit_success`, `booking_submit_success`). | Enabled GTM API automation; created workspace `Cursor GA4 taxonomy v1` with DLVs, custom-event triggers, and GA4 event tags for taxonomy events (draft not auto-published). | Added `docs/architecture/analytics-ga4-gtm-runbook.md`, linked from `overview.md`, and aligned GTM host-gating docs. |
| 2026-03-16 | `cursor/website-indexing-improvements-77fe` | SEO content optimization (trailing slash fix, sitemap hreflang alternates, robots.txt disallow rules, keyword-aligned meta copy, course-specific FAQ). | Data retention updated from 2 months to 14 months. Google Signals confirmed enabled. GA4 linked to Google Ads (499-114-4901) and Search Console. | Published GTM v6 (custom events live), v7 (page view dedup fix), v8 (tag reference routing), v9 (Google Ads AW-18019068393 conversion tag added). Removed duplicate GA4 Page View tag. Fixed dual-destination issue by separating rogue G-H4P7G413SZ tag. | Added `docs/architecture/marketing-stack.md` documenting full GCP/GTM/GA4/Ads/social stack. |
| 2026-03-16 | `cursor/system-user-instagram-scopes-ca01` | Added Meta Pixel integration (`init-meta-pixel.js`, `MetaPixel` component, `trackMetaPixelEvent` helper). Added `links_hub_click` event to taxonomy. Wired Meta Pixel standard events (`Lead`, `Schedule`, `InitiateCheckout`, `Contact`, `ViewContent`) alongside existing GA4 events in conversion components. Added link-in-bio page (`/links`) with click tracking. | No GA4 changes required; `links_hub_click` and Meta Pixel events are additive. A GTM custom-event trigger + GA4 event tag for `links_hub_click` can be added when needed. | No GTM container changes. Meta Pixel loads independently via `init-meta-pixel.js` (not through GTM). | Updated `analytics-ga4-gtm-runbook.md` event catalog. Updated `marketing-stack.md` with Meta Pixel docs and Meta Business account details. |

