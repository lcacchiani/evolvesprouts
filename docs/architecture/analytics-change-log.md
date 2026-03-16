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
| 2026-03-14 | `cursor/ga4-api-access-verification-f10c` | Added shared `trackAnalyticsEvent` instrumentation for contact/media/community/booking/WhatsApp flows. | Created event-scoped custom dimensions, custom metrics (`total_amount`, `discount_amount`), and key events (`contact_form_submit_success`, `media_form_submit_success`, `community_signup_submit_success`, `booking_submit_success`). | Enabled GTM API automation; created workspace `Cursor GA4 taxonomy v1` with DLVs, custom-event triggers, and GA4 event tags for taxonomy events (draft not auto-published). | Added `docs/architecture/analytics-ga4-gtm-runbook.md`, linked from `overview.md`, and aligned GTM host-gating docs. |
| 2026-03-16 | `cursor/website-indexing-improvements-77fe` | SEO content optimization (trailing slash fix, sitemap hreflang alternates, robots.txt disallow rules, keyword-aligned meta copy, course-specific FAQ). | Data retention updated from 2 months to 14 months. Google Signals confirmed enabled. GA4 linked to Google Ads (499-114-4901) and Search Console. | Published GTM v6 (custom events live), v7 (page view dedup fix), v8 (tag reference routing), v9 (Google Ads AW-18019068393 conversion tag added). Removed duplicate GA4 Page View tag. Fixed dual-destination issue by separating rogue G-H4P7G413SZ tag. | Added `docs/architecture/marketing-stack.md` documenting full GCP/GTM/GA4/Ads/social stack. |
| 2026-03-16 | `cursor/system-user-instagram-scopes-ca01` | Added Meta Pixel integration (`init-meta-pixel.js`, `MetaPixel` component, `trackMetaPixelEvent` helper). Added `links_hub_click` event to taxonomy. Wired Meta Pixel standard events (`Lead`, `Schedule`, `InitiateCheckout`, `Contact`, `ViewContent`) alongside existing GA4 events in conversion components. Added link-in-bio page (`/links`) with click tracking. | No GA4 changes required; `links_hub_click` and Meta Pixel events are additive. A GTM custom-event trigger + GA4 event tag for `links_hub_click` can be added when needed. | No GTM container changes. Meta Pixel loads independently via `init-meta-pixel.js` (not through GTM). | Updated `analytics-ga4-gtm-runbook.md` event catalog. Updated `marketing-stack.md` with Meta Pixel docs and Meta Business account details. |

