# Marketing Apply Scripts

Live, write-enabled scripts that operate on Google Ads, Meta, and GA4
via their respective APIs. Complement the read-only assessment scripts
one directory up.

Every apply script follows the same contract:

- `--dry-run` (default): list the operations that would run.
- `--apply`: actually mutate the remote platform.
- Idempotent: re-runs are safe and print "skip (exists)" for no-ops.

Source of truth for the "why" behind each change:

- `apps/public_www/marketing/reports/ads-performance-assessment-2026-04-17.md`
  (assessment + improvement plan).
- `apps/public_www/marketing/reports/google-ads-manual-setup-steps.md`
- `apps/public_www/marketing/reports/meta-ads-manual-setup-steps.md`
- `apps/public_www/marketing/reports/ga4-manual-setup-steps.md`

## Scripts

| Script | Platform | What it does |
|---|---|---|
| `meta-archive-ended-campaigns.py` | Meta | Archives campaigns whose status is ACTIVE/PAUSED and `stop_time` is in the past. |
| `meta-create-custom-audiences.py` | Meta | Creates 6 Custom Audiences (website, course page, Easter Reel viewers, IC-not-Purchase, IG engagers, FB engagers). **Requires one-time Custom Audience ToS acceptance** at `facebook.com/customaudiences/app/tos/?act=<acct_id>` before first run. |
| `google-ads-apply-tuesday-changes.py` | Google Ads | Adds campaign-level negative keywords, phrase-match variants of winners, and UTM-tags enabled ads' final URLs. |
| `google-ads-enable-secondary-conversions.py` | Google Ads | Promotes HIDDEN GA4-synced conversion actions to ENABLED + "Secondary" so they feed bidding without polluting ROAS. |
| `ga4-mark-key-events.py` | GA4 | Creates KeyEvent resources for taxonomy events we want Google Ads to auto-sync as conversion actions. |

## Applied on 2026-04-17

| Script | Result |
|---|---|
| `meta-archive-ended-campaigns.py --apply` | Archived `Easter Workshop — Traffic — HK` and `Instagram Boost — Organic Top Performers`. |
| `meta-create-custom-audiences.py --apply` | **BLOCKED** by error 2663 (Custom Audience ToS not accepted). Human must click through the one-time ToS, then re-run. |
| `google-ads-apply-tuesday-changes.py --apply --all` | Added 29 campaign-level negative keywords, 3 phrase-match variants on Helper Training Course, UTM-tagged 3 enabled ads. |
| `ga4-mark-key-events.py --apply` | Created Key Events for `booking_confirm_pay_click` and `whatsapp_click`. |
| `google-ads-enable-secondary-conversions.py --apply` | Promoted 4 HIDDEN conversion actions to ENABLED (Secondary): media_form, community_signup, booking_confirm_pay_click, whatsapp_click. |

## What is deliberately NOT in an apply script

- **Enhanced Conversions for Web** on Google Ads — no API surface, UI
  toggle only. See
  `../reports/google-ads-manual-setup-steps.md` §1.
- **Meta billing / Business Verification / account status = 9** — no
  API surface; requires a card + verification flow in Business Manager.
- **Launching or un-pausing paid campaigns** (Display remarketing,
  Free Guide relaunch, Evergreen brand, Performance Max) — these
  commit real HKD daily budgets and deserve explicit per-campaign
  human sign-off.
- **Consent Mode v2 banner, CAPI relay Lambda, CloudFront 308
  redirects** — separate code / infra PRs.
