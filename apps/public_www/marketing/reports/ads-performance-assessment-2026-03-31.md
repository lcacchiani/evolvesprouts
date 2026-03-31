# Google Ads & Meta Ads Performance Assessment

**Date**: 2026-03-31 (Tuesday)
**Previous assessment**: 2026-03-30
**Data sources**: Google Ads API (v20), Meta Marketing API (v21.0),
GA4 Data API (v1beta).

---

## Executive Summary

| Platform | Status | Spend (all time) | Impressions | Clicks | Conversions |
|---|---|---|---|---|---|
| Google Ads | Strong daily performance | **HK$392** | **541** | **30** | 0 |
| Meta Easter Traffic | Day 2 | **HK$102** | **5,544** | **459 link clicks** | 0 |
| Meta Engagement (ended) | Ended | HK$347 | 15,281 | 14 | 0 |

Google Ads had its biggest day ever yesterday: **248 impressions, 8
clicks** on March 30. Total clicks now at 30.

The Easter traffic campaign continues to drive massive click volume
(459 link clicks from HK$102 spend), but the bounce problem persists.
GA4 shows 325 sessions from `instagram/paid_social` with only 4 engaged
(99% bounce). However, there's a positive signal: the booking funnel
had its **most active day ever on March 30**, and today a user is deep
in the funnel with 5 date selections and 2 confirm & pay clicks.

---

## Changes Since Last Assessment (March 30)

| What | Mar 30 | Mar 31 | Change |
|---|---|---|---|
| Google Ads impressions | 360 | **541** | +181 |
| Google Ads clicks | 21 | **30** | +9 |
| Google Ads spend | HK$286 | **HK$392** | +HK$106 |
| Meta Easter link clicks | 193 | **459** | +266 |
| Meta Easter landing page views | 114 | **301** | +187 |
| Meta Easter spend | HK$47 | **HK$102** | +HK$55 |
| GA4 sessions (30d) | 379 | **603** | **+224 (+59%)** |
| GA4 users (30d) | 322 | **540** | **+218** |
| GA4 instagram/paid_social | 118 (0 engaged) | **325 (4 engaged)** | +207, **4 engaged** |
| GA4 booking_modal_open | 21 (9 users) | **26 (9 users)** | +5 events |
| GA4 booking_age_selected | 17 (5 users) | **24 (5 users)** | +7 events |
| GA4 booking_date_selected | 8 (3 users) | **17 (3 users)** | **+9 events** |
| GA4 booking_confirm_pay_click | 7 (4 users) | **12 (4 users)** | **+5 events** |
| GA4 Google CPC sessions | 18 | **26** | +8 |

---

## Meta Ads — Easter Traffic Campaign (Day 2)

### Cumulative performance

| Metric | Day 1 (Mar 30) | Day 2 (Mar 31) | Total |
|---|---|---|---|
| Impressions | 2,929 | 2,615 | **5,544** |
| Reach | 2,695 | 2,420 | **4,924** |
| Link clicks | 223 | 236 | **459** |
| Landing page views | 134 | 167 | **301** |
| Video views | — | — | **2,082** |
| CPC (link click) | HK$0.23 | HK$0.21 | **HK$0.22** |
| Cost/LPV | HK$0.39 | HK$0.30 | **HK$0.34** |
| Spend | HK$52.04 | HK$49.85 | **HK$101.89** |

Day 2 is slightly better than Day 1 — more link clicks (236 vs 223),
more landing page views (167 vs 134), and lower CPC. The creative is
performing consistently well. CTR increased from 15.3% to 18.0%.

### Bounce rate — slight improvement

GA4 shows `instagram/paid_social` went from 100% bounce (Day 1) to
**99% bounce** (Day 1+2 combined). **4 people from the ad engaged**
with the site (vs 0 yesterday). Small improvement but directionally
positive.

The Easter landing page has 360 sessions at 95% bounce. The organic
version (`/easter-2026-montessori-play-coaching-workshop` without
`/en/`) still shows 40% bounce — confirming this is an ad-to-page
issue, not a page quality issue.

---

## Google Ads Assessment

### Biggest day yet

| Date | Impressions | Clicks | Cost |
|---|---|---|---|
| Mar 28 | 58 | 6 | HK$98 |
| Mar 29 | 73 | 8 | HK$99 |
| **Mar 30** | **248** | **8** | **HK$100** |

March 30 had **248 impressions** — the most ever by a wide margin
(3.4x the previous best). The campaign hit the HK$100/day effective
ceiling for the first time.

### All-time totals

| Metric | Value |
|---|---|
| Impressions | 541 |
| Clicks | 30 |
| CTR | 5.55% |
| CPC | HK$13.07 |
| Total Spend | HK$392 |

### Keyword performance

| Keyword (broad) | Imp | Clicks | CTR | CPC | Cost |
|---|---|---|---|---|---|
| helper training hong kong | 261 | 17 | 6.51% | HK$14.54 | HK$247 |
| domestic helper course hong kong | 159 | 7 | 4.40% | HK$12.72 | HK$89 |
| childcare helper training | 121 | 6 | 4.96% | HK$9.31 | HK$56 |

All three keywords now have meaningful data. "childcare helper training"
remains the most cost-efficient (HK$9.31/click). The second ad variant
(800467050954) is getting more impressions (108, up from 51) — Google
is testing it more.

---

## GA4 Website Analytics (Last 30 Days)

### Site overview

| Metric | Mar 19 | Mar 30 | Mar 31 | Full period |
|---|---|---|---|---|
| Sessions | 80 | 379 | **603** | **+654%** |
| Users | 58 | 322 | **540** | **+831%** |
| Engaged | 28 | 90 | **100** | +257% |
| Bounce | 65.0% | 76.3% | **83.4%** | Up (ad traffic) |
| Pageviews | 127 | 530 | **760** | +499% |

### Traffic sources

| Source / Medium | Sessions | Engaged | Bounce |
|---|---|---|---|
| instagram / paid_social | **325** | 4 | 99% |
| (direct) / (none) | 144 | 33 | 77% |
| google / organic | **47** | **26** | **45%** |
| google / cpc | **26** | 5 | 81% |
| l.instagram.com / referral | **19** | 9 | 53% |
| facebook.com / referral | 16 | 15 | **6%** |

Google organic grew to **47 sessions** (was 43 yesterday, 19 on Mar 19).
Instagram organic referral at 19 sessions — growing steadily.

### Booking funnel — most active period

| Event | Mar 30 | Mar 31 | Change |
|---|---|---|---|
| booking_modal_open | 21 (9 users) | **26 (9 users)** | +5 events |
| booking_age_selected | 17 (5 users) | **24 (5 users)** | +7 events |
| booking_date_selected | 8 (3 users) | **17 (3 users)** | **+9 events** |
| booking_confirm_pay_click | 7 (4 users) | **12 (4 users)** | **+5 events** |

**March 30 was the busiest booking day ever:**
- 5 modal opens (3 users)
- 8 age selections (2 users)
- 6 date selections (2 users)
- 3 confirm & pay clicks (1 user)
- 3 WhatsApp clicks (3 users)

**Today (March 31)** another user is deep in the funnel:
- 5 date selections and 2 confirm & pay clicks from 1 user
- They're actively comparing dates/cohorts

### Funnel comparison (start vs now)

| Event | Mar 19 | Mar 31 | Growth |
|---|---|---|---|
| Modal opens (users) | 2 | **9** | +350% |
| Age selected (users) | 1 | **5** | +400% |
| Date selected (users) | 1 | **3** | +200% |
| Confirm & Pay (users) | 1 | **4** | +300% |
| Payment method (users) | 0 | 1 | — |
| WhatsApp clicks (users) | 0 | **3** | — |

### Top landing pages

| Page | Sessions | Bounce |
|---|---|---|
| /en/easter-2026... (ad traffic) | **360** | 95% |
| /en | 72 | 49% |
| / | 43 | 63% |
| /en/services/my-best-auntie... | 31 | 84% |
| /links + /en/links | 11 | **0%** |
| /easter-2026... (organic) | 10 | **40%** |

---

## Total Ad Spend Summary

| Campaign | Status | Spend | Key metric |
|---|---|---|---|
| Meta Engagement | Ended | HK$347 | 144 engagements |
| Meta Easter Traffic | Day 2 | HK$102 | 459 link clicks |
| Google Ads Search | Running | HK$392 | 30 clicks |
| **Total** | | **HK$841** | |

---

## Key Observations

### Positive signals despite bounce

1. **Booking funnel is the most active it's ever been** — 12 confirm &
   pay clicks from 4 users (was 1 user on Mar 19). Something is driving
   interest.
2. **Google Ads at scale** — 248 impressions in a single day, spending
   the full daily budget. The HK market is bigger than initial data
   suggested.
3. **Meta CTR keeps improving** — 18% on Day 2 (up from 15% on Day 1).
   The Reel creative resonates strongly.
4. **4 people from the Easter ad engaged** — up from 0 yesterday. The
   bounce rate improved marginally (100% → 99%).
5. **Google organic at 47 sessions** — consistent growth, best
   engagement quality (45% bounce).

### The bounce problem persists

325 sessions from `instagram/paid_social` with only 4 engaged. The ad
is spending HK$50/day driving people who don't engage. This is HK$50/day
x 5 remaining days = HK$250 at risk.

**Decision point**: Is the booking funnel activity (which has spiked in
the same period) coming from the ad traffic despite the bounce? Or is
it from organic/other sources? If any of the 4 engaged Meta visitors
entered the booking funnel, the campaign is working despite the bounce
numbers. If the booking activity is all organic, the Meta spend isn't
converting.

---

## Data Integrity Notes

- Google Ads API queried via service account through MCC.
- Meta Marketing API queried via system user token.
- GA4 Data API queried via service account for property 525520074.
- All queries read-only.
- Google Ads daily data for Mar 30 shows 248 impressions, which accounts
  for the large jump in all-time totals (360 → 541 is +181, with
  today's partial data making up the difference).
