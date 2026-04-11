# Google Ads & Meta Ads Performance Assessment

**Date**: 2026-03-30 (Monday)
**Previous assessment**: 2026-03-29
**Data sources**: Google Ads API (v20), Meta Marketing API (v21.0),
GA4 Data API (v1beta).

---

## Executive Summary

| Platform | Status | Spend (all time) | Impressions | Clicks | Conversions |
|---|---|---|---|---|---|
| Google Ads | Running strong | HK$286 | 360 | 21 | 0 |
| Meta — Engagement (ended) | Ended Mar 24 | HK$347 | 15,281 | 14 | 0 |
| **Meta — Easter Traffic (NEW)** | **Day 1** | **HK$47** | **2,618** | **193 link clicks** | **0** |

The Easter traffic campaign launched today and is delivering massive
volume: **193 link clicks and 114 landing page views from HK$47 spend**
(HK$0.24/link click, HK$0.41/landing page view). However, GA4 shows
the traffic has **100% bounce rate** — people are clicking through but
not engaging with the Easter landing page.

Google Ads continues accelerating: 360 total impressions, 21 clicks,
a third keyword is now generating clicks.

**First WhatsApp clicks ever recorded** — 3 users clicked WhatsApp
CTAs today.

---

## Changes Since Last Assessment (March 29)

| What | Mar 29 | Mar 30 | Change |
|---|---|---|---|
| **Easter campaign launched** | — | **Day 1** | **NEW** |
| Meta Easter spend | — | **HK$47** | — |
| Meta Easter link clicks | — | **193** | — |
| Meta Easter landing page views | — | **114** | — |
| Meta Easter CPC (link click) | — | **HK$0.24** | — |
| Google Ads impressions | 133 | **360** | **+227 (+171%)** |
| Google Ads clicks | 14 | **21** | **+7** |
| Google Ads spend | HK$197 | **HK$286** | +HK$89 |
| GA4 sessions (30d) | 239 | **379** | **+140 (+59%)** |
| GA4 users (30d) | 185 | **322** | **+137** |
| GA4 whatsapp_click | 0 | **3** | **First ever** |
| GA4 booking_modal_open | 19 (8 users) | 21 (9 users) | +2 events, +1 user |
| GA4 booking_date_selected | 6 (2 users) | 8 (3 users) | +2 events, +1 user |

---

## Meta Ads — Easter Traffic Campaign (Day 1)

### Performance — exceptional volume, concerning quality

| Metric | Value |
|---|---|
| Impressions | 2,618 |
| Reach | 2,396 |
| Total Clicks | 399 |
| **Link Clicks** | **193** |
| **Landing Page Views** | **114** |
| Video Views | 924 |
| CTR (all clicks) | 15.24% |
| **CPC (link click)** | **HK$0.24** |
| **Cost per Landing Page View** | **HK$0.41** |
| CPM | HK$17.82 |
| Total Spend | HK$46.64 |

The click-through performance is extraordinary — HK$0.24 per link click
is far below the HK$3-8 range I estimated. The Reel creative is working
extremely well at driving clicks.

However, there's a significant drop-off in the click funnel:
- 399 total clicks (includes video interactions)
- 193 link clicks (people who tapped the CTA)
- **114 landing page views** (people who waited for the page to load)

**79 people (41% of link clickers) abandoned before the page loaded.**
This suggests either slow page load on mobile or people accidentally
tapping.

### GA4 attribution — high bounce problem

| Source | Sessions | Engaged | Bounce |
|---|---|---|---|
| instagram / paid_social | **118** | **0** | **100%** |

All 118 sessions from the Easter ad have **zero engagement** (no scroll,
no click, no 10 seconds on page). The Easter landing page has gone from
24 sessions (50% bounce) to 145 sessions (**92% bounce**).

**This is the #1 issue to address.** The ad is driving clicks cheaply
but the landing page isn't catching anyone. Possible causes:
1. Page load speed on mobile — 41% of link clickers didn't even see
   the page load
2. Content mismatch — the Reel talks about Eva and stacking rings, but
   the landing page opens with event logistics. The emotional hook
   doesn't carry through
3. The landing page may need a stronger above-the-fold experience
   for ad traffic (similar to the course page issue)

---

## Google Ads Assessment

### Performance — accelerating further

| Metric | Mar 29 | Mar 30 | Change |
|---|---|---|---|
| Impressions (all time) | 133 | **360** | +227 |
| Clicks (all time) | 14 | **21** | +7 |
| CTR | 10.53% | 5.83% | Normalizing (still excellent) |
| CPC | HK$14.04 | **HK$13.64** | Improving |
| Spend | HK$197 | **HK$286** | +HK$89 |

March 29 was the biggest day yet: **73 impressions and 8 clicks**
(HK$99 spend).

### Keyword performance — third keyword producing clicks

| Keyword (broad) | Imp | Clicks | CTR | CPC | Cost |
|---|---|---|---|---|---|
| helper training hong kong | 186 | 13 | 6.99% | HK$15.48 | HK$201 |
| domestic helper course hong kong | 109 | **3** | 2.75% | HK$13.14 | HK$39 |
| childcare helper training | 65 | **5** | 7.69% | **HK$9.13** | HK$46 |

"domestic helper course hong kong" now has its first 3 clicks.
"childcare helper training" remains the most cost-efficient at
HK$9.13/click.

### GA4 attribution

| Source | Sessions | Engaged | Bounce |
|---|---|---|---|
| google/cpc — campaign attributed | 16 | — | — |
| google/cpc — (not set) | 2 | — | — |
| **Total google/cpc** | **18** | **4** | **78%** |

Google Ads sessions growing (was 10 on Mar 29, now 18). Bounce rate
still high at 78% but better than the Meta traffic (100%).

---

## GA4 Website Analytics (Last 30 Days)

### Site overview

| Metric | Mar 29 | Mar 30 | Change |
|---|---|---|---|
| Sessions | 239 | **379** | **+59%** |
| Users | 185 | **322** | **+74%** |
| Engaged | 85 | **90** | +6% |
| Bounce | 64.4% | **76.3%** | Up (Meta traffic) |
| Pageviews | 376 | **530** | +41% |

The jump in sessions is almost entirely from the Meta Easter campaign
(118 sessions). But the engagement count barely moved (+5), meaning the
new traffic is bouncing without engaging.

### Traffic sources

| Source / Medium | Sessions | Engaged | Bounce |
|---|---|---|---|
| (direct) / (none) | 141 | 30 | 79% |
| **instagram / paid_social** | **118** | **0** | **100%** |
| google / organic | 43 | 25 | **42%** |
| google / cpc | 18 | 4 | 78% |
| l.instagram.com / referral | 17 | 9 | 47% |
| facebook.com / referral | 16 | 15 | **6%** |
| m.facebook.com / referral | 5 | 2 | 60% |

Facebook referral continues to be the gold standard (6% bounce, 94%
engagement). Google organic is the best high-volume source (42% bounce).
Instagram organic referral is decent (47% bounce). The paid traffic
from both Google (78%) and Meta (100%) bounces at much higher rates.

### Booking funnel — WhatsApp clicks appear

| Event | Mar 29 | Mar 30 | Change |
|---|---|---|---|
| booking_modal_open | 19 (8 users) | **21 (9 users)** | +2 events, +1 user |
| booking_age_selected | 16 (4 users) | **17 (5 users)** | +1 event, +1 user |
| booking_date_selected | 6 (2 users) | **8 (3 users)** | +2 events, +1 user |
| booking_confirm_pay_click | 7 (4 users) | 7 (4 users) | — |
| **whatsapp_click** | **0** | **3 (3 users)** | **First ever** |

**3 WhatsApp clicks today** — the first time this event has appeared in
the data. These are users tapping the WhatsApp contact button on the
site. This is a conversion signal even though it doesn't show as a
booking — they're reaching out directly.

New booking funnel activity: 2 modal opens, 1 age selection, 2 date
selections from new users.

### Top landing pages

| Page | Sessions | Bounce | Note |
|---|---|---|---|
| **/en/easter-2026-montessori-play-coaching-workshop** | **145** | **92%** | **Ad traffic bouncing** |
| /en | 71 | 48% | Homepage |
| / | 41 | 68% | Root redirect |
| /en/services/my-best-auntie-training-course | 24 | 83% | Course page |
| /links + /en/links | 11 | **9%** | Bio link — excellent |
| /easter-2026-montessori-play-coaching-workshop | 10 | 40% | Easter (non-locale, organic) |

The Easter page went from 24 to 145 sessions in one day. Organic
traffic to the Easter page (the non-locale version) still has 40%
bounce — confirming the high bounce is specific to the paid ad traffic,
not the page itself for organic visitors.

---

## Total Ad Spend Summary

| Campaign | Status | Spend | Key result |
|---|---|---|---|
| Meta Engagement (ended) | Ended Mar 24 | HK$347 | 144 engagements |
| Meta Easter Traffic | Day 1 | HK$47 | 193 link clicks, 114 LPVs |
| Google Ads Search | Running | HK$286 | 21 clicks |
| **Total** | | **HK$680** | |

---

## Key Priorities

### 1. Fix Easter landing page bounce (URGENT)

114 people landed on the Easter page from the ad today and 100% bounced.
At HK$50/day this is burning through budget with zero engagement. Either:
- Improve the page load speed (check mobile Lighthouse score)
- Add a stronger above-the-fold hook that matches the Reel's emotional
  message
- Simplify the page for ad traffic (fewer sections, faster to CTA)
- Or consider sending traffic to a different destination (homepage,
  WhatsApp direct)

### 2. Investigate the WhatsApp clicks

3 WhatsApp clicks from 3 users is a meaningful conversion signal. Check
your WhatsApp Business inbox — did any of these turn into conversations?

### 3. Keep Google Ads running

Google Ads is performing well — 21 clicks at HK$13.64 CPC with
consistent daily growth. No changes needed.

---

## Data Integrity Notes

- Google Ads API queried via service account through MCC (544-581-2170).
- Meta Marketing API queried via system user token.
- GA4 Data API queried via service account for property 525520074.
- All queries read-only.
- Meta Easter campaign data is from first partial day (launched ~12:15 HKT).
