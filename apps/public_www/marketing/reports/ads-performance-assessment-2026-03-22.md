# Google Ads & Meta Ads Performance Assessment

**Date**: 2026-03-22
**Previous assessments**: 2026-03-19, 2026-03-20, 2026-03-21
**Data sources**: Google Ads API (v20), Meta Marketing API (v21.0),
GA4 Data API (v1beta).

---

## Executive Summary

| Platform | Status | Spend (all time) | Impressions | Engagements | Clicks | Conversions |
|---|---|---|---|---|---|---|
| Google Ads | **First impression** after keyword + bidding fix | HK$0 | **1** | — | 0 | 0 |
| Meta Ads | Day 6 of 7, campaign ends tomorrow | HK$290 | 14,444 | **109** | 14 | 0 |

Google Ads finally served its **first impression** — the broader keywords
and Maximize Clicks bidding switch from yesterday are working. The keyword
"domestic helper course hong kong" (broad match) generated the impression.

Meta Ads continues to perform strongly. Engagements reached 109 (up from
74 yesterday), with today showing a notable spike in clicks (5, the first
clicks since the optimization switch). Cost per engagement is now HK$2.66.
The campaign ends March 24.

---

## Changes Since Last Assessment (March 21)

| What | Mar 21 | Mar 22 | Change |
|---|---|---|---|
| **Google Ads impressions** | 0 | **1** | **First impression ever** |
| Google Ads bidding | Manual CPC | Maximize Clicks (HK$20 cap) | Changed Mar 21 |
| Google Ads keywords | 11 (all RARELY_SERVED) | 18 (7 new broad) | +7 added Mar 21 |
| Meta total spend | HK$207.12 | HK$249.04 | +HK$41.92 |
| Meta impressions | 13,824 | 14,444 | +620 |
| Meta engagements | 74 | **109** | **+35 (+47%)** |
| Meta cost/engagement | HK$3.28 | **HK$2.66** | -19% |
| Meta reactions | 69 | 102 | +33 |
| Meta comments | 3 | 5 | +2 |
| Meta clicks | 9 | **14** | **+5 (all today)** |
| GA4 sessions (30d) | 119 | 129 | +10 |
| GA4 users (30d) | 87 | 97 | +10 |
| GA4 Instagram referral | 2 | 3 (+1 ig/social) | +2 |

---

## Google Ads Assessment

### Status: First sign of life after keyword + bidding fix

| Metric | Value |
|---|---|
| Impressions (all time) | **1** |
| Clicks | 0 |
| Cost | HK$0.00 |
| Bidding | Maximize Clicks (HK$20 cap) — changed Mar 21 |
| Budget | HK$50/day |

The keyword and bidding changes made yesterday are starting to work.
The campaign generated its **first ever impression** from the broad-match
keyword "domestic helper course hong kong". The ad shown was Ad
800467058814 (the "Helper Training in Hong Kong" variant).

This is a very small start but confirms:
1. The bidding switch to Maximize Clicks worked
2. Broader keywords are entering auctions
3. The ad is approved and eligible to serve

It will take several more days for Google to learn which queries and
audiences work for this campaign. The Maximize Clicks algorithm needs
data to optimize. Expect impressions to ramp up gradually.

### Keyword status after fix

| Type | Count | Status |
|---|---|---|
| New broad-match (added Mar 21) | 7 | 2 ELIGIBLE, 5 RARELY_SERVED |
| Original phrase-match | 8 | All RARELY_SERVED |
| Original exact-match | 3 | All RARELY_SERVED |

The keyword "domestic helper course hong kong" (broad) generated the
first impression. "helper training hong kong" and "childcare helper
training" (both broad) are also ELIGIBLE and should start serving soon.

---

## Meta Ads Assessment

### Campaign: Instagram Boost — Organic Top Performers

| Field | Value |
|---|---|
| Status | ACTIVE (day 6 of 7, **ends March 24**) |
| Optimization | POST_ENGAGEMENT |
| Total Spend | HK$289.88 |
| Remaining | ~1-2 days |

### Cumulative performance (6 days: March 17-22)

| Metric | Value |
|---|---|
| Impressions | 14,444 |
| Reach | 10,557 |
| Frequency | 1.37 |
| Clicks | 14 (13 unique) |
| CTR | 0.097% |
| CPC | HK$20.71 |
| CPM | HK$20.07 |
| Total Spend | HK$289.88 |

### Engagement actions (cumulative)

| Action | Count |
|---|---|
| Post reactions | 102 |
| Comments | 5 |
| Post saves | 2 |
| Post engagement (total) | 109 |
| Net likes | 96 |

### Daily breakdown

| Date | Opt | Imp | Reach | Clicks | Eng | CPM | Cost/Eng | Spend |
|---|---|---|---|---|---|---|---|---|
| Mar 17 | REACH | 4,418 | 4,418 | 2 | 2 | HK$10.61 | HK$23.44 | HK$46.88 |
| Mar 18 | REACH | 4,519 | 4,348 | 1 | 1 | HK$10.81 | HK$48.83 | HK$48.83 |
| Mar 19 | Mixed | 3,885 | 3,885 | 6 | 10 | HK$14.02 | HK$5.45 | HK$54.45 |
| Mar 20 | POST_ENG | 591 | 448 | 0 | 37 | HK$96.38 | HK$1.54 | HK$56.96 |
| Mar 21 | POST_ENG | 503 | 408 | 0 | 29 | HK$83.34 | HK$1.45 | HK$41.92 |
| Mar 22 | POST_ENG | 528 | 443 | **5** | 30 | HK$77.35 | HK$1.36 | HK$40.84 |

### Notable today (March 22)

- **5 clicks** — the first clicks since the POST_ENGAGEMENT optimization
  switch. CTR jumped to 0.95% for the day (vs 0% on Mar 20-21). This
  suggests the algorithm is now finding people who both engage AND click.
- **2 new comments** — the most comments in a single day.
- **Cost per engagement: HK$1.36** — lowest single-day cost yet.
- CPM continues to decrease (HK$77.35, down from HK$96.38 on Mar 20),
  indicating the algorithm is settling into a more efficient delivery
  pattern.

### Full optimization impact summary

| Phase | Days | Imp | Eng | Cost/Eng | Daily Eng | Clicks |
|---|---|---|---|---|---|---|
| REACH (Mar 17-18) | 2 | 8,937 | 3 | HK$31.90 | 1.5 | 3 |
| POST_ENG (Mar 19-22) | 4 | 5,507 | 106 | HK$1.83 | 26.5 | 11 |

POST_ENGAGEMENT has delivered **17x more efficient** engagement and is
now also starting to generate clicks.

---

## GA4 Website Analytics (Last 30 Days)

### Site overview

| Metric | Mar 19 | Mar 20 | Mar 21 | Mar 22 | Trend |
|---|---|---|---|---|---|
| Sessions | 80 | 102 | 119 | 129 | +61% from Mar 19 |
| Users | 58 | 73 | 87 | 97 | +67% |
| Engaged Sessions | 28 | 35 | 41 | 41 | +46% |
| Bounce Rate | 65.0% | 65.7% | 65.5% | 68.2% | Slightly up |
| Pageviews | 127 | 170 | 190 | 207 | +63% |
| Conversions | 0 | 0 | 0 | 0 | — |

### Traffic sources

| Source / Medium | Sessions | Engaged | Bounce |
|---|---|---|---|
| (direct) / (none) | 77 | 13 | 83% |
| google / organic | 27 | 14 | 48% |
| facebook.com / referral | 10 | 9 | 10% |
| l.instagram.com / referral | 3 | 2 | 33% |
| google / cpc | 2 | 1 | 50% |
| ig / social | 1 | 0 | 100% |

New source appearing: `ig/social` — this is traffic from an Instagram
post with UTM tags (likely the boosted post or a Story link).

Instagram referral is growing: 3 sessions from `l.instagram.com` (up
from 1 on Mar 19) plus 1 from `ig/social`.

### Booking funnel

No new booking funnel activity today. Same as March 21:
- 8 age selections (2 users), 2 date selections (1 user),
  1 confirm & pay click (1 user), 0 submissions.

### Top landing pages

| Page | Sessions | Bounce | Note |
|---|---|---|---|
| /en | 39 | 51% | Homepage (English) |
| / | 22 | 64% | Root redirect |
| /ZWFzdGVyLT | 7 | 86% | Broken base64 link (unchanged) |
| /easter-2026-montessori-play-coaching-workshop | 6 | 67% | Easter workshop |
| /en/easter-2026-montessori-play-coaching-workshop | 6 | 83% | Easter workshop (English) |
| /links | 4 | 25% | Link-in-bio (low bounce, working well) |
| /easter | 3 | 0% | Easter redirect |
| /en/services/my-best-auntie-training-course | 3 | 100% | Course page |
| /event/toilet-learning-apr-25 | 3 | 100% | Toilet learning event |
| /workshops | 3 | 100% | Workshops page |

The `/links` page is performing well (25% bounce, up from 0%) — users
arriving from the Instagram bio link are engaging with the site.

---

## Key Takeaways

### What's improved

1. **Google Ads is alive**: First impression generated from the broader
   keywords added yesterday. Expect gradual ramp-up over the next week.
2. **Meta engagement efficiency continues improving**: HK$1.36/engagement
   today, with clicks returning (5 today vs 0 on Mar 20-21).
3. **Instagram referral growing**: 4 sessions total from Instagram
   sources (up from 1 on Mar 19), confirming the Meta boost is
   driving some website traffic.
4. **Links page working**: `/links` has 25% bounce rate — the Instagram
   bio link page is effectively funneling users into the site.

### What still needs attention

1. **Google Ads volume**: 1 impression is progress but far from useful.
   Monitor daily — if still <10 impressions by March 26, consider
   adding even broader keywords or expanding to Display network.
2. **Zero conversions**: 129 sessions, 0 completed bookings or form
   submissions. Priority is driving more qualified traffic.
3. **Meta campaign ending**: The Instagram boost ends March 24. Plan
   the next campaign — consider a TRAFFIC objective to drive website
   visitors, or boost another high-performing organic post.
4. **Broken Easter link**: `/ZWFzdGVyLT` still at 7 sessions. Source
   is direct/none (likely WhatsApp). Find and fix the broken link.

---

## Data Integrity Notes

- Google Ads API queried via service account through MCC (544-581-2170).
- Meta Marketing API queried via system user token.
- GA4 Data API queried via service account for property 525520074.
- All queries read-only. No changes made to any platform.
- March 22 Meta daily data is partial (day not yet complete).
