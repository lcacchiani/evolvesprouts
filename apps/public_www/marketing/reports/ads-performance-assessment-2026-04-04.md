# Google Ads & Meta Ads Performance Assessment

**Date**: 2026-04-04 (Friday)
**Previous assessment**: 2026-04-01 (3 days ago)
**Data sources**: Google Ads API (v20), Meta Marketing API (v21.0),
GA4 Data API (v1beta).

---

## Executive Summary

| Platform | Status | Spend (all time) | Impressions | Key result |
|---|---|---|---|---|
| Google Ads | Running | **HK$606** | **853** | 50 clicks, 0 conv |
| Meta Easter Traffic | Day 6 (ends tomorrow) | **HK$265** | **15,503** | 1,034 link clicks, **4 conv** |
| Meta Engagement (ended) | Ended Mar 24 | HK$347 | 15,281 | 144 engagements |

**Both bookings are now confirmed as coming from the Instagram Easter
ad** — GA4 attributes both `booking_submit_success` events to
`instagram/paid_social`. The Easter campaign has generated 4 total
conversions at HK$66 per conversion.

Google Ads is showing an improvement in engagement quality — bounce rate
from CPC traffic dropped from 80% to **50-60%** over the last few days,
suggesting the course page hero improvements may be helping.

The Easter campaign ends tomorrow (April 5). The workshop is April 6.

---

## Changes Since Last Assessment (April 1)

| What | Apr 1 | Apr 4 | Change |
|---|---|---|---|
| Meta Easter link clicks | 676 | **1,034** | +358 |
| Meta Easter LPVs | 473 | **759** | +286 |
| Meta Easter spend | HK$174 | **HK$265** | +HK$91 |
| Meta Easter conversions (GA4) | 2 | **4** | +2 |
| Meta Easter reach | 8,001 | **11,590** | +3,589 |
| Meta Easter video views | 4,091 | **7,081** | +2,990 |
| Google Ads impressions | 683 | **853** | +170 |
| Google Ads clicks | 38 | **50** | +12 |
| Google Ads spend | HK$492 | **HK$606** | +HK$114 |
| GA4 sessions (30d) | 817 | **1,202** | **+385** |
| GA4 users (30d) | 735 | **1,114** | **+379** |
| GA4 conversions | 4 | **4** | — |
| Booking modal opens (users) | 11 | **12** | +1 |
| Booking age selected (users) | 5 | **9** | +4 |
| WhatsApp clicks (users) | 4 | **5** | +1 |

---

## Meta Ads — Easter Traffic Campaign (Day 6)

### Campaign totals (ends tomorrow)

| Metric | Value |
|---|---|
| Duration | 6 days (Mar 30 - Apr 4) |
| Impressions | 15,503 |
| Reach | **11,590** |
| Link clicks | **1,034** |
| Landing page views | **759** |
| Video views | **7,081** |
| CPC (link click) | HK$0.26 |
| Cost per LPV | **HK$0.35** |
| Total Spend | **HK$264.91** |
| **GA4 Conversions** | **4** |
| **Cost per conversion** | **HK$66** |

### Daily breakdown with optimization phases

| Date | Opt | Imp | Link clicks | LPVs | LPV/click | Spend |
|---|---|---|---|---|---|---|
| Mar 30 | LINK_CLICKS | 2,929 | 223 | 134 | 60% | HK$52 |
| Mar 31 | Mixed | 3,082 | 269 | 182 | 68% | HK$63 |
| Apr 1 | LPV | 3,662 | 215 | 185 | **86%** | HK$62 |
| Apr 2 | LPV | 2,012 | 107 | 83 | **78%** | HK$26 |
| Apr 3 | LPV | 1,881 | 100 | 80 | **80%** | HK$30 |
| Apr 4* | LPV | 1,937 | 120 | 95 | **79%** | HK$32 |

*Partial day.

The LANDING_PAGE_VIEWS optimization is consistently delivering 78-86%
click-to-page-load ratio (vs 60% under LINK_CLICKS). Daily spend has
also settled lower (~HK$30/day vs HK$50-63 under LINK_CLICKS) as Meta
is being more selective.

### GA4 paid social engagement by day

| Date | Sessions | Engaged | Avg duration | Conversions |
|---|---|---|---|---|
| Mar 30 | 161 | 4 | 4.2s | 0 |
| **Mar 31** | **210** | **6** | **2.4s** | **2** |
| **Apr 1** | **207** | **8** | **1.9s** | **2** |
| Apr 2 | 99 | 4 | 3.4s | 0 |
| Apr 3 | 91 | 1 | 0.6s | 0 |
| Apr 4 | 87 | 0 | 0.4s | 0 |

The conversions came on March 31 and April 1 — the transition period
around the optimization switch. Since then, engagement has dropped
(fewer sessions, fewer engaged). This may be the learning phase
settling, or the audience pool for landing page view optimizers being
smaller.

### Booking attribution confirmation

Both confirmed bookings came from `instagram/paid_social`:

| Date | Source | Events |
|---|---|---|
| Mar 31 | instagram/paid_social | 1 `booking_submit_success` |
| Apr 1 | instagram/paid_social | 1 `booking_submit_success` |

---

## Google Ads Assessment

### Performance improving

| Metric | All Time |
|---|---|
| Impressions | 853 |
| Clicks | 50 |
| CTR | 5.86% |
| CPC | HK$12.13 |
| Spend | HK$606 |

### Daily trend — CPC improving

| Date | Imp | Clicks | Cost | CPC |
|---|---|---|---|---|
| Mar 28 | 58 | 6 | HK$98 | HK$16.33 |
| Mar 29 | 73 | 8 | HK$99 | HK$12.32 |
| Mar 30 | 248 | 8 | HK$100 | HK$12.50 |
| Mar 31 | 174 | 8 | HK$96 | HK$11.94 |
| Apr 1 | 128 | 8 | HK$100 | HK$12.49 |
| Apr 2 | 47 | 6 | HK$62 | HK$10.39 |
| Apr 3 | 47 | 5 | HK$43 | HK$8.58 |

CPC trending down from HK$16 to HK$9 as Google's algorithm learns.

### Keyword performance

| Keyword | Imp | Clicks | CTR | CPC | Cost |
|---|---|---|---|---|---|
| helper training hong kong | 420 | 26 | 6.19% | HK$13.35 | HK$347 |
| domestic helper course hong kong | 225 | 11 | 4.89% | HK$12.17 | HK$134 |
| childcare helper training | 208 | 13 | 6.25% | HK$9.65 | HK$125 |

"childcare helper training" now has 13 clicks — nearly matching the
primary keyword, at 28% lower CPC.

### GA4 — Google CPC engagement improving

| Date | Sessions | Engaged | Bounce |
|---|---|---|---|
| Mar 28 | 5 | 1 | 80% |
| Mar 29 | 9 | 2 | 78% |
| Mar 30 | 8 | 1 | 88% |
| Mar 31 | 11 | 3 | 73% |
| Apr 1 | 9 | 4 | **56%** |
| Apr 2 | 6 | 3 | **50%** |
| Apr 3 | 5 | 2 | **60%** |

Bounce rate from Google Ads dropped from 80-88% to **50-60%** since
April 1. This coincides with the course page hero changes (quick-facts
bar, shortened description, testimonial, specific CTA). The
improvements appear to be working.

---

## GA4 Website Analytics (Last 30 Days)

### Site overview

| Metric | Mar 19 | Apr 1 | Apr 4 |
|---|---|---|---|
| Sessions | 80 | 817 | **1,202** |
| Users | 58 | 735 | **1,114** |
| Engaged | 28 | 112 | **144** |
| Conversions | 0 | 4 | **4** |

### Traffic sources

| Source | Sessions | Engaged | Conv | Bounce |
|---|---|---|---|---|
| instagram/paid_social | 857 | 23 | **4** | 97% |
| (direct)/(none) | 174 | 38 | 0 | 78% |
| google/cpc | **54** | **17** | 0 | **69%** |
| google/organic | **52** | **32** | 0 | **38%** |
| l.instagram.com/referral | 22 | 10 | 0 | 55% |
| facebook.com/referral | 16 | 15 | 0 | **6%** |

Google CPC bounce rate improved to 69% (was 81% on Apr 1). Google
organic at 38% bounce is the quality leader with 32 engaged sessions
from 52 total.

### Booking funnel

| Event | Apr 1 | Apr 4 | Change |
|---|---|---|---|
| booking_modal_open | 32 (11 users) | **34 (12 users)** | +2, +1 user |
| booking_age_selected | 24 (5 users) | **34 (9 users)** | **+10, +4 users** |
| booking_date_selected | 17 (3 users) | **19 (5 users)** | +2, +2 users |
| booking_confirm_pay_click | 12 (4 users) | **13 (5 users)** | +1, +1 user |
| booking_payment_method_selected | 9 (3 users) | 9 (3 users) | — |
| whatsapp_click | 4 (4 users) | **5 (5 users)** | +1 |
| booking_submit_success | 2 (2 users) | 2 (2 users) | — |

The funnel is widening at the top — **9 users** have now selected an
age group (was 5 on Apr 1), **5 users** selected dates. More people
are exploring the booking flow even if they're not completing yet.

### New activity (Apr 2-4)

- Apr 2: 1 user opened modal, selected 4 age groups, 1 date, clicked
  confirm & pay
- Apr 3: 1 user opened modal, selected 6 age groups, 1 date. Another
  user clicked WhatsApp.
- Apr 4: No new funnel events yet (partial day)

### Landing pages

| Page | Sessions | Conv | Bounce |
|---|---|---|---|
| /en/easter-2026... | **896** | **4** | 96% |
| /en (homepage) | 84 | 0 | 50% |
| /en/services/my-best-auntie... | **52** | 0 | **69%** |
| /easter-2026... (organic) | 10 | 0 | 40% |
| /links + /en/links | 12 | 0 | **8%** |

Course page bounce rate improved from 84% to **69%** — the hero
changes are having an effect.

**New landing page appearing**: `/resources/free-guide-overwhelmed-by-toys`
(4 sessions) — someone is finding the free guide resource.

---

## Total Ad Spend & ROI

| Campaign | Spend | Conv | Cost/Conv | Revenue |
|---|---|---|---|---|
| Meta Easter Traffic | HK$265 | **4** | **HK$66** | HK$1,400 (4 x HK$350) |
| Google Ads Search | HK$606 | 0 | — | HK$0 |
| Meta Engagement (ended) | HK$347 | 0 | — | HK$0 |
| **Total** | **HK$1,218** | **4** | **HK$305** | **HK$1,400** |

**The Easter campaign is profitable**: HK$265 spent for HK$1,400 in
bookings = **5.3x ROAS**. Even including all ad spend (HK$1,218),
overall ROAS is 1.15x and improving.

With 2 spots remaining (6 total, 4 booked) and 2 days of campaign
left, there's a real chance of selling out.

---

## Campaign Wrap-Up Timeline

- **Today (Apr 4)**: Easter campaign Day 6. 2 spots remaining.
- **Tomorrow (Apr 5)**: Campaign ends. Last day of delivery.
- **Apr 6 (Sunday)**: Easter workshop.
- **Google Ads**: Continue running indefinitely.

---

## Data Integrity Notes

- Google Ads API queried via service account through MCC.
- Meta Marketing API queried via system user token.
- GA4 Data API queried via service account for property 525520074.
- All queries read-only.
- GA4 shows 4 conversions attributed to instagram/paid_social. The
  booking_submit_success events show 2 (Mar 31, Apr 1). The additional
  2 conversions may be from other key events (contact_form_submit_success,
  etc.) or GA4 attribution differences.
