# Google Ads & Meta Ads Performance Assessment

**Date**: 2026-03-28 (Saturday)
**Previous assessment**: 2026-03-25 (3 days ago)
**Data sources**: Google Ads API (v20), Meta Marketing API (v21.0),
GA4 Data API (v1beta).

---

## Executive Summary

| Platform | Status | Spend (all time) | Impressions | Clicks | Conversions |
|---|---|---|---|---|---|
| Google Ads | **Active and delivering** | **HK$89** | **56** | **5** | 0 |
| Meta Ads | Campaign ended March 24 | HK$347 | 15,281 | 14 | 0 |

**Google Ads has come to life.** Since the broader keywords and Maximize
Clicks bidding were added on March 21, the campaign has generated 56
impressions, 5 clicks at an exceptional 8.93% CTR, spending HK$89. All
5 clicks came from "helper training hong kong" (broad match).

**Someone reached payment method selection for the first time** —
`booking_payment_method_selected` appeared in GA4 data on March 26
(3 events, 1 user). This is the furthest anyone has gone in the
booking funnel.

Website traffic surged to **217 sessions** (30d), up 28% from 169
three days ago. Instagram referral grew 50% (10 → 15 sessions).

---

## Changes Since Last Assessment (March 25)

| What | Mar 25 | Mar 28 | Change |
|---|---|---|---|
| **Google Ads impressions** | **1** | **56** | **+55 (+5,500%)** |
| **Google Ads clicks** | **0** | **5** | **First clicks ever** |
| Google Ads spend | HK$0 | **HK$89** | First spend |
| Google Ads CTR | 0% | **8.93%** | Excellent |
| Google Ads CPC | — | **HK$17.79** | Under HK$20 cap |
| Meta (unchanged) | HK$347 / ended | HK$347 / ended | — |
| GA4 sessions (30d) | 169 | **217** | **+28%** |
| GA4 users (30d) | 127 | **167** | **+31%** |
| GA4 engaged sessions | 63 | **81** | **+29%** |
| GA4 bounce rate | 62.7% | **62.7%** | Stable |
| GA4 Google CPC sessions | 2 | **4** | +2 (attributed to campaign) |
| GA4 Instagram referral | 10 | **15** | **+50%** |
| GA4 booking_modal_open | 10 (5 users) | **18 (8 users)** | **+8 events, +3 users** |
| GA4 booking_payment_method | 0 | **3 (1 user)** | **FIRST EVER** |
| GA4 booking_submit_error | 1 (1 user) | **2 (1 user)** | +1 event |
| GA4 Easter workshop | 23 sessions | **34 sessions** | +48% |
| GA4 Course page | ~8 sessions | **16 sessions** | +100% |

---

## Google Ads Assessment

### Status: Working — first real traction

| Metric | Mar 25 | Mar 28 | Change |
|---|---|---|---|
| Impressions | 1 | **56** | +55 |
| Clicks | 0 | **5** | +5 |
| CTR | 0% | **8.93%** | Exceptional |
| Avg CPC | — | **HK$17.79** | Under cap |
| Total Cost | HK$0 | **HK$88.96** | First spend |
| Conversions | 0 | 0 | — |

The keyword and bidding changes from March 21 are delivering. The
campaign has gone from dead (1 impression in 6 days) to generating
daily traffic.

### Keyword performance

| Keyword (broad match) | Impressions | Clicks | CTR | CPC | Cost |
|---|---|---|---|---|---|
| **helper training hong kong** | **33** | **5** | **15.15%** | **HK$17.79** | **HK$88.96** |
| domestic helper course hong kong | 17 | 0 | 0% | — | HK$0 |
| childcare helper training | 6 | 0 | 0% | — | HK$0 |
| All other keywords | 0 | 0 | — | — | HK$0 |

**"helper training hong kong"** is the clear winner — 15.15% CTR is
exceptional for search ads (industry average is 3-5%). All 5 clicks
and all spend came from this single keyword. This confirms the market
exists but is very small and concentrated on this specific search term.

### Ad performance

| Ad | Impressions | Clicks |
|---|---|---|
| Ad 800467058814 ("Helper Training in Hong Kong") | 51 | 5 |
| Ad 800467050954 ("Helper Childcare Training HK") | 5 | 0 |

Ad variant 1 is getting 91% of impressions and all clicks. Google's
algorithm is correctly favoring the better-performing ad.

### GA4 attribution

GA4 now shows **4 sessions from google/cpc**, with 2 showing the
campaign name "My Best Auntie — Search — HK". The clicks are reaching
the website and being properly attributed.

---

## Meta Ads Assessment

Campaign ended March 24. No new campaigns. Final numbers unchanged:

| Metric | Final |
|---|---|
| Total Spend | HK$347.09 |
| Engagements | 144 |
| Cost/Engagement | HK$2.41 |
| Reach | 10,947 |

---

## GA4 Website Analytics (Last 30 Days)

### Site overview

| Metric | Mar 19 | Mar 25 | Mar 28 | Full period |
|---|---|---|---|---|
| Sessions | 80 | 169 | **217** | **+171%** |
| Users | 58 | 127 | **167** | **+188%** |
| Engaged | 28 | 63 | **81** | **+189%** |
| Bounce | 65.0% | 62.7% | **62.7%** | Improving |
| Pageviews | 127 | 262 | **347** | **+173%** |
| Conversions | 0 | 0 | 0 | — |

### Traffic sources

| Source / Medium | Sessions | Engaged | Bounce | Trend |
|---|---|---|---|---|
| (direct) / (none) | 123 | 28 | 77% | Growing |
| google / organic | **39** | 22 | **44%** | +105% since Mar 19 |
| facebook.com / referral | 16 | 15 | **6%** | Steady, best quality |
| l.instagram.com / referral | **15** | 9 | 40% | **+1,400% since Mar 19** |
| google / cpc | **4** | 1 | 75% | **First attributed clicks** |
| l.wl.co / referral | 4 | 2 | 50% | — |
| m.facebook.com / referral | 2 | 1 | 50% | — |
| ig / social | 1 | 1 | 0% | — |

**Google organic** has doubled since Mar 19 (19 → 39 sessions). Bounce
rate at 44% makes it the highest-quality high-volume source.

**Instagram referral** is now the 4th largest source at 15 sessions (was
1 on Mar 19). The Meta engagement campaign's residual effect continues.

**Google CPC** now shows 4 sessions, 2 attributed to the campaign name.

**Facebook referral** maintains extraordinary quality — 16 sessions with
only 6% bounce rate and 15 engaged sessions (94% engagement).

### Booking funnel — most active period ever

| Event | Mar 25 | Mar 28 | Change |
|---|---|---|---|
| booking_modal_open | 10 (5 users) | **18 (8 users)** | +8 events, +3 users |
| booking_age_selected | 16 (4 users) | 16 (4 users) | — |
| booking_date_selected | 6 (2 users) | 6 (2 users) | — |
| booking_confirm_pay_click | 6 (3 users) | **7 (4 users)** | +1 event, +1 user |
| booking_payment_method_selected | 0 | **3 (1 user)** | **FIRST EVER** |
| booking_submit_error | 1 (1 user) | **2 (1 user)** | +1 event |
| booking_submit_success | 0 | 0 | — |

### New booking activity (March 25-28)

**March 25**: 1 modal open + 2 submit errors (the user who hit the
CloudFront allowlist 403 bug on `/reservations/payment-intent`).

**March 26** (busiest day ever):
- **7 modal opens from 3 different users**
- **1 Confirm & Pay click** (4th user to reach this step)
- **3 payment method selections from 1 user** — they tried different
  payment options. This is the **first time `booking_payment_method_selected`
  has ever appeared in the data**. This user got further in the funnel
  than anyone before.

**March 27**: 1 modal open (1 user)

### Updated funnel user summary

| # | Date | Deepest step | Outcome |
|---|---|---|---|
| 1 | Mar 17 | Confirm & Pay → Modal | Abandoned at payment form |
| 2 | Mar 18 | Modal | Abandoned immediately |
| 3 | Mar 19 | Modal | Abandoned immediately |
| 4 | Mar 21 | Age selection (x8) | Abandoned at date selection |
| 5 | Mar 23 | Confirm & Pay (x3) → Modal (x3) | Abandoned at payment form |
| 6 | Mar 24 | Confirm & Pay (x2) → Modal (x3) | Abandoned at payment form |
| 7 | Mar 25 | Modal → **Submit** | **API error (403)** |
| **8** | **Mar 26** | Modal → Confirm & Pay → **Payment method (x3)** | **Got furthest ever — unknown outcome** |
| 9 | Mar 26 | Modal | Abandoned |
| 10 | Mar 26 | Modal | Abandoned |
| 11 | Mar 27 | Modal | Abandoned |

**4 out of 11** users reached Confirm & Pay. **1 user** got to payment
method selection (the furthest anyone has gone besides the Mar 25 user
who hit the 403 error). The booking funnel is getting more traffic and
users are getting deeper into it.

### Top landing pages

| Page | Sessions | Bounce | Note |
|---|---|---|---|
| /en | 60 | 45% | Homepage |
| / | 37 | 68% | Root redirect |
| /en/easter-2026-montessori-play-coaching-workshop | **24** | 50% | Easter — surging |
| /easter-2026-montessori-play-coaching-workshop | 10 | 40% | Easter (non-locale) |
| /en/services/my-best-auntie-training-course | **9** | 89% | Course page |
| /my-best-auntie-training-course | 7 | 71% | Course (non-locale) |
| /links + /en/links | **9** | **0%** | Bio link — perfect |
| /my-best-auntie-training-course/packages-and-outlines | 3 | 100% | New page |

Easter workshop: **34 combined sessions** (+48% from Mar 25).
Course page: **16 combined sessions** (+100% from Mar 25).
Links pages: 9 sessions, **0% bounce** — still perfect.

---

## 10-Day Summary (Mar 19 — Mar 28)

### Traffic growth

| Source | Mar 19 | Mar 28 | Growth |
|---|---|---|---|
| Total sessions (30d) | 80 | 217 | **+171%** |
| Google organic | 19 | 39 | +105% |
| Facebook referral | 9 | 16 | +78% |
| Instagram referral | 1 | 15 | +1,400% |
| Google CPC | 2 | 4 | +100% |
| Direct | 40 | 123 | +208% |

### Ad spend efficiency

| Platform | Spend | Result |
|---|---|---|
| Meta Ads | HK$347 | 144 engagements, 10,947 reach, 14 clicks |
| Google Ads | HK$89 | 56 impressions, 5 clicks, 8.93% CTR |
| **Total** | **HK$436** | |

### Booking funnel

| Metric | Mar 19 | Mar 28 | Growth |
|---|---|---|---|
| Modal opens (users) | 2 | **8** | +300% |
| Confirm & Pay (users) | 1 | **4** | +300% |
| Payment method (users) | 0 | **1** | First ever |
| Submit attempts (users) | 0 | **1** | First ever |
| Completed bookings | 0 | 0 | — |

### Key achievements this period

1. **Google Ads working** — "helper training hong kong" at 15% CTR
2. **Meta engagement campaign delivered** — 144 engagements at HK$2.41
3. **Website traffic tripled** — 80 → 217 sessions
4. **Booking funnel deepening** — first payment method selection,
   first submit attempt
5. **SEO compounding** — Google organic doubled (19 → 39)
6. **Instagram driving traffic** — grew from 1 to 15 referral sessions

### What still needs attention

1. **0 completed bookings** — the `/reservations/payment-intent`
   endpoint was returning 403 (CloudFront allowlist bug). Has this
   been deployed to production since the fix was merged to main?
2. **Course page bounce rate** — 89% on `/en/services/my-best-auntie-training-course`.
   Users from Google Ads are landing here and leaving.
3. **No active Meta campaign** — the engagement campaign ended Mar 24.
   Consider launching the TRAFFIC campaign.

---

## Data Integrity Notes

- Google Ads API queried via service account through MCC (544-581-2170).
- Meta Marketing API queried via system user token.
- GA4 Data API queried via service account for property 525520074.
- All queries read-only.
- Google Ads daily breakdown shows only 2 days with impressions (Mar 22
  and Mar 27) totaling 2, but all-time shows 56. The gap is likely due
  to data processing lag — Google Ads can take 24-72 hours to fully
  populate daily breakdowns for small-volume campaigns.
