# Google Ads & Meta Ads Performance Assessment

**Date**: 2026-03-29 (Saturday)
**Previous assessment**: 2026-03-28 (1 day ago)
**Data sources**: Google Ads API (v20), Meta Marketing API (v21.0),
GA4 Data API (v1beta).

---

## Executive Summary

| Platform | Status | Spend (all time) | Impressions | Clicks | CTR | Conversions |
|---|---|---|---|---|---|---|
| Google Ads | **Accelerating** | **HK$197** | **133** | **14** | **10.53%** | 0 |
| Meta Ads | Ended March 24 | HK$347 | 15,281 | 14 | 0.09% | 0 |

**Google Ads has found its stride.** The campaign more than doubled
since yesterday — 133 impressions and 14 clicks total, with a
remarkable 10.53% CTR. A second keyword ("childcare helper training")
is now generating clicks alongside the original winner. HK$197 total
spend.

Google Ads now shows **10 sessions** in GA4 (up from 4 yesterday),
with 8 properly attributed to the campaign name. However, the
bounce rate from CPC traffic is 80% — the course landing page needs
attention.

Website traffic reached **239 sessions** (30d). Google organic
continues climbing to 43 sessions. No new booking funnel activity
since March 28.

---

## Changes Since Last Assessment (March 28)

| What | Mar 28 | Mar 29 | Change |
|---|---|---|---|
| **Google Ads impressions** | 56 | **133** | **+77 (+138%)** |
| **Google Ads clicks** | 5 | **14** | **+9 (+180%)** |
| Google Ads CTR | 8.93% | **10.53%** | +1.6pp |
| Google Ads spend | HK$89 | **HK$197** | +HK$108 |
| Google Ads CPC | HK$17.79 | **HK$14.04** | **-21% (improving)** |
| GA4 Google CPC sessions | 4 | **10** | **+6** |
| GA4 sessions (30d) | 217 | **239** | +22 |
| GA4 users (30d) | 167 | **185** | +18 |
| GA4 Google organic | 39 | **43** | +4 |
| GA4 course page sessions | 16 | **23** | +44% |

---

## Google Ads Assessment

### Performance — accelerating

| Metric | All Time | Last 7 Days | Daily run rate |
|---|---|---|---|
| Impressions | 133 | 60 | ~9/day |
| Clicks | 14 | 6 | ~1/day |
| CTR | 10.53% | 10.00% | Consistent |
| CPC | HK$14.04 | HK$16.33 | Under cap |
| Cost | HK$196.58 | HK$97.99 | ~HK$14/day |

The daily performance breakdown shows March 28 was a breakout day:
**58 impressions and 6 clicks in a single day** (HK$98 spend). The
campaign is now consistently delivering daily traffic.

### Keyword performance — second keyword emerging

| Keyword (broad) | Imp | Clicks | CTR | CPC | Cost |
|---|---|---|---|---|---|
| **helper training hong kong** | **80** | **10** | **12.50%** | **HK$16.01** | **HK$160** |
| domestic helper course hong kong | 32 | 0 | 0% | — | HK$0 |
| **childcare helper training** | **21** | **4** | **19.05%** | **HK$9.12** | **HK$36** |
| All other keywords | 0 | 0 | — | — | HK$0 |

**"childcare helper training"** is now the second active keyword with
an even better CTR (19.05%) and lower CPC (HK$9.12) than the main
keyword. It generated 4 clicks at nearly half the cost per click.

### Ad performance — both variants getting clicks now

| Ad | Imp | Clicks | CTR | Cost |
|---|---|---|---|---|
| 800467058814 ("Helper Training in Hong Kong") | 114 | 12 | 10.5% | HK$180 |
| 800467050954 ("Helper Childcare Training HK") | 19 | 2 | 10.5% | HK$17 |

Both ads now have clicks. Google is still favoring the first variant
(86% of impressions) but the second is getting some rotation.

### GA4 attribution

| Source | Sessions | Engaged | Bounce |
|---|---|---|---|
| google/cpc — My Best Auntie campaign | 8 | — | — |
| google/cpc — (not set) | 2 | — | — |
| **Total google/cpc** | **10** | **2** | **80%** |

The 80% bounce rate from CPC traffic is a concern. Of 10 sessions from
Google Ads, only 2 were engaged. Users are clicking the ad, landing on
the course page, and leaving. This suggests:
- The landing page doesn't match what they expected from the ad
- The page loads too slowly on mobile
- The above-the-fold content doesn't hook them

### Cost analysis

| Period | Spend | Clicks | CPC |
|---|---|---|---|
| Mar 22 (first day) | HK$0 | 0 | — |
| Mar 22-28 (first week) | HK$89 | 5 | HK$17.79 |
| Mar 28 alone | HK$98 | 6 | HK$16.33 |
| **All time** | **HK$197** | **14** | **HK$14.04** |

CPC is trending down (HK$17.79 → HK$14.04) as Google's algorithm
learns. At the current ~HK$14/day spend, you're well within the
HK$50/day budget.

---

## Meta Ads Assessment

Campaign ended March 24. No changes. Final numbers unchanged:
HK$347 spent, 144 engagements, HK$2.41/engagement, 10,947 reach.

No new Meta campaigns running.

---

## GA4 Website Analytics (Last 30 Days)

### Site overview

| Metric | Mar 19 | Mar 25 | Mar 28 | Mar 29 |
|---|---|---|---|---|
| Sessions | 80 | 169 | 217 | **239** |
| Users | 58 | 127 | 167 | **185** |
| Engaged | 28 | 63 | 81 | **85** |
| Bounce | 65.0% | 62.7% | 62.7% | **64.4%** |
| Pageviews | 127 | 262 | 347 | **376** |

### Traffic sources

| Source / Medium | Sessions | Engaged | Bounce |
|---|---|---|---|
| (direct) / (none) | 134 | 29 | 78% |
| google / organic | **43** | **24** | **44%** |
| facebook.com / referral | 16 | 15 | **6%** |
| l.instagram.com / referral | 15 | 9 | 40% |
| **google / cpc** | **10** | **2** | **80%** |

Google organic is the clear quality leader — 43 sessions with 56%
engagement rate and 44% bounce. Facebook referral remains extraordinary
(94% engagement, 6% bounce).

Google CPC is bringing volume but poor quality — 80% bounce needs to
be addressed through landing page optimization.

### Booking funnel

| Event | Mar 28 | Mar 29 | Change |
|---|---|---|---|
| booking_modal_open | 18 (8 users) | **19 (8 users)** | +1 event |
| booking_age_selected | 16 (4 users) | 16 (4 users) | — |
| booking_confirm_pay_click | 7 (4 users) | 7 (4 users) | — |
| booking_payment_method_selected | 3 (1 user) | 3 (1 user) | — |
| booking_submit_error | 2 (1 user) | 2 (1 user) | — |

One new modal open on March 28, but no deeper funnel progression.
The funnel has been quiet for the last 2 days after the active period
of March 23-26.

### Top landing pages

| Page | Sessions | Bounce | Note |
|---|---|---|---|
| /en | 69 | 49% | Homepage |
| / | 38 | 66% | Root redirect |
| /en/easter-2026-montessori-play-coaching-workshop | 24 | 50% | Easter |
| **/en/services/my-best-auntie-training-course** | **16** | **88%** | **Course — high bounce** |
| /easter-2026-montessori-play-coaching-workshop | 10 | 40% | Easter (non-locale) |
| /my-best-auntie-training-course | 7 | 71% | Course (non-locale) |
| /links + /en/links | 9 | **0%** | Bio link — perfect |
| /event/my-best-auntie-0-1-nov-25-2 | 3 | 100% | Old event page |

The course page (`/en/services/my-best-auntie-training-course`) at
**88% bounce rate** and **16 sessions** is the biggest conversion
opportunity. This is where Google Ads traffic lands. Reducing this
bounce rate is the highest-leverage improvement available.

Easter workshop pages: 34 combined sessions, 50% bounce on locale
version — performing well.

---

## 11-Day Summary (Mar 19 — Mar 29)

### Total ad spend

| Platform | Spend | Clicks | CPC |
|---|---|---|---|
| Meta Ads | HK$347 | 14 | HK$24.79 |
| Google Ads | HK$197 | 14 | HK$14.04 |
| **Total** | **HK$544** | **28 clicks** | |

Google Ads has matched Meta's total click count (14 each) at 43% lower
cost per click. However, Meta's 144 engagements provided brand
awareness that Google Ads can't replicate.

### Traffic growth

| Source | Mar 19 | Mar 29 | Growth |
|---|---|---|---|
| Total sessions (30d) | 80 | **239** | **+199%** |
| Google organic | 19 | **43** | **+126%** |
| Instagram referral | 1 | **15** | **+1,400%** |
| Facebook referral | 9 | 16 | +78% |
| Google CPC | 2 | **10** | **+400%** |

### Key priorities

1. **Fix course page bounce rate (88%)** — this is where Google Ads
   traffic lands and 88% leave immediately. Above-the-fold content,
   load speed on mobile, and a clear value proposition need review.
2. **Launch Meta TRAFFIC campaign for Easter** — the Easter page has
   50% bounce (much better than course page) and time-sensitive demand.
3. **Check Google Ads search terms** — with 133 impressions now, the
   search terms report will show what queries are actually triggering
   the ads. Look for irrelevant matches to add as negatives.

---

## Data Integrity Notes

- Google Ads API queried via service account through MCC (544-581-2170).
- Meta Marketing API queried via system user token.
- GA4 Data API queried via service account for property 525520074.
- All queries read-only.
