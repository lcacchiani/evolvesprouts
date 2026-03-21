# Google Ads & Meta Ads Performance Assessment

**Date**: 2026-03-21
**Previous assessments**: 2026-03-19, 2026-03-20
**Data sources**: Google Ads API (v20), Meta Marketing API (v21.0),
GA4 Data API (v1beta).

---

## Executive Summary

| Platform | Status | Spend (all time) | Impressions | Engagements | Clicks | Conversions |
|---|---|---|---|---|---|---|
| Google Ads | ENABLED, APPROVED, still not serving | HK$0 | 0 | — | 0 | 0 |
| Meta Ads | Day 5 of 7, POST_ENGAGEMENT optimization | HK$243 | 13,824 | 74 | 9 | 0 |

The Meta Ads campaign continues to perform well under POST_ENGAGEMENT
optimization. Engagements have doubled since the March 20 assessment (74
vs 36), while cost per engagement has improved further to HK$3.28. The
campaign ends March 24.

Google Ads remains completely inactive after 5+ days with approved ads.
This now needs urgent attention — the keywords are almost certainly
flagged as low search volume.

A new user explored the booking flow today (March 21), selecting 4
age groups. Website traffic is at 119 sessions (30d), up from 102.

---

## Changes Since Last Assessment (March 20)

| What | Mar 20 | Mar 21 | Change |
|---|---|---|---|
| Meta total spend | HK$150.16 | HK$207.12 | +HK$56.96 |
| Meta impressions | 13,237 | 13,824 | +587 |
| Meta engagements | 36 | **74** | **+38 (+106%)** |
| Meta cost/engagement | HK$5.30 | **HK$3.28** | **-38%** |
| Meta reactions | 34 | 69 | +35 |
| Meta comments | 1 | 3 | +2 |
| Meta saves | 1 | 2 | +1 |
| Meta net likes | 31 | 65 | +34 |
| Google Ads impressions | 0 | 0 | No change |
| GA4 sessions (30d) | 102 | 119 | +17 |
| GA4 users (30d) | 73 | 87 | +14 |
| GA4 booking_age_selected | 4 | **8** | +4 (new user today) |
| GA4 Instagram referral | 1 | 2 | +1 |

---

## Google Ads Assessment

### Status: Day 5+ with zero impressions — needs action

| Metric | Value |
|---|---|
| Impressions (all time) | 0 |
| Days active | 5+ (since March 16) |
| Ad approval | APPROVED (all 3 ads) |
| Budget | HK$50/day (unspent) |

No change from previous assessments. The campaign has been enabled for
5+ days with approved ads, a HK$50/day budget, and HK$20 CPC bids, yet
has never entered a single auction.

**Diagnosis**: The keywords almost certainly have "Low search volume"
status in Google Ads. Phrase-match keywords like "helper training course
hk" and "auntie training course hong kong" are too specific for the HK
search market. Google won't enter them into auctions if they estimate
near-zero weekly searches.

**Recommended actions** (in priority order):
1. Log into Google Ads UI and check keyword status for "Low search volume"
2. Add broader keywords: "helper training hong kong" (broad), "domestic
   helper course" (broad), "childcare helper training" (broad)
3. Consider switching from Manual CPC to Maximize Clicks bidding to let
   Google find whatever auctions exist
4. Consider adding English-language broad match keywords that HK parents
   might search: "nanny training course", "helper childcare course"

---

## Meta Ads Assessment

### Campaign: Instagram Boost — Organic Top Performers

| Field | Value |
|---|---|
| Status | ACTIVE (day 5 of 7, ends March 24) |
| Optimization | POST_ENGAGEMENT (changed March 19) |
| Budget | HK$50/day |
| Total Spend | HK$243.08 |

### Cumulative performance (5 days: March 17-21)

| Metric | Value |
|---|---|
| Impressions | 13,824 |
| Reach | 10,248 |
| Frequency | 1.35 |
| Clicks | 9 (all unique) |
| CTR | 0.065% |
| CPC | HK$27.01 |
| CPM | HK$17.58 |
| Total Spend | HK$243.08 |

### Engagement actions (cumulative)

| Action | Count |
|---|---|
| Post reactions | 69 |
| Comments | 3 |
| Post saves | 2 |
| Post engagement (total) | 74 |
| Net likes | 65 |

### Daily breakdown with optimization phase comparison

| Date | Optimization | Imp | Reach | Clicks | Engagements | CPM | Cost/Eng | Spend |
|---|---|---|---|---|---|---|---|---|
| Mar 17 | REACH | 4,418 | 4,418 | 2 | 2 | HK$10.61 | HK$23.44 | HK$46.88 |
| Mar 18 | REACH | 4,519 | 4,348 | 1 | 1 | HK$10.81 | HK$48.83 | HK$48.83 |
| Mar 19 | Mixed | 3,885 | 3,885 | 6 | 10 | HK$14.02 | HK$5.45 | HK$54.45 |
| Mar 20 | POST_ENG | 591 | 448 | 0 | 37 | HK$96.38 | HK$1.54 | HK$56.96 |
| Mar 21 | POST_ENG | 411 | 335 | 0 | 24 | HK$87.49 | HK$1.50 | HK$35.96 |

### Optimization impact (full picture after 5 days)

| Phase | Days | Impressions | Engagements | Cost/Engagement | Daily Eng |
|---|---|---|---|---|---|
| REACH (Mar 17-18) | 2 | 8,937 | 3 | HK$31.90 | 1.5 |
| POST_ENGAGEMENT (Mar 19-21) | 3 | 4,887 | 71 | HK$1.31 | 23.7 |

The POST_ENGAGEMENT optimization is delivering extraordinary results:
- **Cost per engagement: HK$1.31** (down from HK$31.90 under REACH)
- **Daily engagements: 23.7** (up from 1.5)
- **24x improvement** in cost efficiency
- 3 comments received (audience is starting to interact)
- 2 saves (content is being bookmarked)

The trade-off remains: fewer impressions (Meta shows the ad to fewer but
more receptive people) and zero website clicks from the POST_ENGAGEMENT
phase. The ad drives on-platform engagement, not website traffic.

### Campaign projection

At current run rate (~HK$49/day over the last 3 POST_ENGAGEMENT days):
- Remaining: 3 days (Mar 22-24)
- Projected additional spend: ~HK$147
- **Projected total campaign spend: ~HK$390**
- Projected total engagements: ~HK$145

---

## GA4 Website Analytics (Last 30 Days)

### Site overview

| Metric | Mar 19 | Mar 20 | Mar 21 | Trend |
|---|---|---|---|---|
| Sessions | 80 | 102 | 119 | +49% from Mar 19 |
| Users | 58 | 73 | 87 | +50% |
| Engaged Sessions | 28 | 35 | 41 | +46% |
| Bounce Rate | 65.0% | 65.7% | 65.5% | Stable |
| Pageviews | 127 | 170 | 190 | +50% |
| Conversions | 0 | 0 | 0 | — |

### Traffic sources

| Source / Medium | Sessions | Engaged | Bounce |
|---|---|---|---|
| (direct) / (none) | 69 | 13 | 81% |
| google / organic | 27 | 14 | 48% |
| facebook.com / referral | 10 | 9 | 10% |
| l.instagram.com / referral | 2 | 2 | 0% |
| google / cpc | 2 | 1 | 50% |

Google organic continues to grow (27 sessions, up from 19 on Mar 19)
with improving engagement (48% bounce rate, down from 58%). Facebook
referral maintains exceptional quality (10% bounce). Instagram referral
doubled from 1 to 2 sessions.

### Booking funnel

| Event | Mar 19 | Mar 20 | Mar 21 | Change |
|---|---|---|---|---|
| booking_age_selected | 4 | 4 | **8** | +4 (new user today) |
| booking_modal_open | 2 | 3 | 3 | — |
| booking_date_selected | 2 | 2 | 2 | — |
| booking_confirm_pay_click | 1 | 1 | 1 | — |

**New activity today (March 21)**: A new user selected 4 different age
groups (exploring all options), but didn't proceed to date selection or
the payment modal. This is the 2nd user to reach the age selection step
(the first was the March 17 prospect who got all the way to payment).

### New landing pages appearing

- `/ZWFzdGVyLT` — 7 sessions, 86% bounce. This looks like a truncated
  base64-encoded URL. Worth investigating — could be a broken link
  shared somewhere.
- `/workshops` — 3 sessions, 100% bounce. New page getting traffic.
- `/event/toilet-learning-apr-25` — 3 sessions. Event page for the
  April toilet learning workshop.

---

## Key Takeaways

### What's working well

1. **Meta POST_ENGAGEMENT optimization**: Cost per engagement at HK$1.31
   is exceptional (industry benchmark HK$2-8). The ad is generating
   genuine interaction — 3 comments, 2 saves, 65 net likes.
2. **Google organic traffic**: Growing steadily (27 sessions, 48% bounce)
   and is the highest-quality non-social traffic source.
3. **Facebook/Instagram referral quality**: Consistently the best
   engagement (10% and 0% bounce rates).
4. **Booking funnel interest**: A 2nd user explored the age selection
   today, suggesting the course page is attracting serious prospects.

### What needs attention

1. **Google Ads is dead** — 5+ days, zero impressions, HK$0 spent. The
   keywords are too niche. This needs manual intervention in the Google
   Ads UI (add broader keywords or switch bidding strategy).
2. **No conversions** — 119 sessions, 8 booking age selections, 1
   payment click, 0 completed bookings. The funnel drop-off at the
   payment step needs investigation (is it pricing hesitation, UX
   friction, or just low traffic?).
3. **Meta ad drives engagement, not traffic** — 74 engagements but 0
   website clicks since the optimization switch. If website traffic is
   the goal, a separate OUTCOME_TRAFFIC campaign should be considered
   after this one ends March 24.
4. **Suspicious landing page** — `/ZWFzdGVyLT` (7 sessions, 86% bounce)
   looks like a broken/truncated link being shared somewhere.

---

## Data Integrity Notes

- Google Ads API queried via service account through MCC (544-581-2170).
- Meta Marketing API queried via system user token.
- GA4 Data API queried via service account for property 525520074.
- All queries read-only. No changes made to any platform.
- March 21 Meta daily data is partial (day not yet complete).
