# Google Ads & Meta Ads Performance Assessment

**Date**: 2026-03-25 (Tuesday)
**Previous assessments**: 2026-03-19 through 2026-03-24
**Data sources**: Google Ads API (v20), Meta Marketing API (v21.0),
GA4 Data API (v1beta).

---

## Executive Summary

| Platform | Status | Spend (all time) | Impressions | Engagements | Clicks | Conversions |
|---|---|---|---|---|---|---|
| Google Ads | 1 impression (unchanged) | HK$0 | 1 | — | 0 | 0 |
| Meta Ads | Campaign ended March 24 | HK$347 | 15,281 | 144 | 14 | 0 |

**Critical new event today: someone tried to submit a booking and got an
error.** This is the first `booking_submit_error` ever recorded — a user
got further than anyone before, past the payment method selection that
has blocked all previous prospects, and actually attempted to submit.

Website traffic continues to accelerate: 169 sessions (30d), Facebook
referral surged to 16 sessions with a **6% bounce rate**, and the Easter
workshop pages are pulling 23 combined sessions.

---

## Changes Since Last Assessment (March 24)

| What | Mar 24 | Mar 25 | Change |
|---|---|---|---|
| Google Ads impressions | 1 | 1 | No change |
| Meta campaign | Final day | **Ended** | Complete |
| GA4 sessions (30d) | 153 | **169** | **+16** |
| GA4 users (30d) | 117 | **127** | **+10** |
| GA4 engaged sessions | 53 | **63** | **+10** |
| GA4 bounce rate | 65.4% | **62.7%** | **Improving** |
| GA4 Facebook referral | 11 | **16** | **+5 (45%)** |
| GA4 Instagram referral | 9 | **10** | +1 |
| GA4 Google organic | 32 | **36** | **+4** |
| GA4 booking_modal_open | 7 (4 users) | **10 (5 users)** | +3 events, +1 user |
| GA4 booking_confirm_pay_click | 5 (3 users) | 6 (3 users) | +1 event |
| GA4 booking_date_selected | 5 (2 users) | 6 (2 users) | +1 event |
| GA4 **booking_submit_error** | **0** | **1 (1 user)** | **FIRST EVER** |
| GA4 Easter workshop sessions | 18 | **23** | +5 |

---

## Google Ads Assessment

### Status: Confirmed dead channel

Still 1 total impression (from Mar 22). No new impressions in 3 days
despite broader keywords and Maximize Clicks bidding. Today is Tuesday
— a normal business day in HK — confirming this isn't a weekend effect.

**Verdict**: Google Search is not a viable channel for helper training
in Hong Kong. The search volume simply doesn't exist. Keep the campaign
running passively (costs nothing) and redirect ad budget entirely to
Meta.

---

## Meta Ads Assessment

### Campaign complete — final numbers

The Instagram Boost campaign ended March 24. Final results are unchanged
from yesterday's report:

| Metric | Final Value |
|---|---|
| Duration | 8 days (Mar 17-24) |
| Total Spend | **HK$347.09** |
| Reach | 10,947 unique people |
| Engagements | **144** |
| Cost per Engagement | **HK$2.41** |
| Comments | 6 |
| Saves | 3 |
| Net Likes | 127 |

No active Meta campaigns running. Next campaign decision pending.

---

## GA4 Website Analytics (Last 30 Days)

### Site overview — growth accelerating post-campaign

| Metric | Mar 19 | Mar 24 | Mar 25 | Full week change |
|---|---|---|---|---|
| Sessions | 80 | 153 | **169** | **+111%** |
| Users | 58 | 117 | **127** | **+119%** |
| Engaged | 28 | 53 | **63** | **+125%** |
| Bounce | 65.0% | 65.4% | **62.7%** | **Improving** |
| Pageviews | 127 | 238 | **262** | **+106%** |

Traffic has more than doubled in a week, and notably the growth is
continuing even after the Meta campaign ended. Organic and social
referral sources are sustaining momentum.

### Traffic sources — Facebook referral exploding

| Source / Medium | Mar 24 | Mar 25 | Change |
|---|---|---|---|
| (direct) / (none) | 87 | 93 | +6 |
| google / organic | 32 | **36** | **+4** |
| facebook.com / referral | 11 | **16** | **+5 (45%)** |
| l.instagram.com / referral | 9 | **10** | +1 |
| m.facebook.com / referral | 2 | 2 | — |
| ig / social | 1 | 1 | — |

**Facebook referral: 16 sessions, 15 engaged, 6% bounce rate.** This is
the highest-quality traffic source by a wide margin. The boosted post
continues to drive referral traffic even though the campaign ended
yesterday — likely people saving the post and clicking through later, or
sharing it with friends.

**Google organic: 36 sessions** (was 19 on Mar 19). Almost doubled in
a week. Bounce rate down to 44% — this is becoming a reliable source
of engaged visitors.

**Combined social: 29 sessions** (facebook.com + l.instagram.com +
m.facebook.com + ig/social). Social sources now account for 17% of all
traffic, with the best engagement quality across the board.

### Booking funnel — FIRST SUBMISSION ATTEMPT

| Event | Mar 24 | Mar 25 | Change |
|---|---|---|---|
| booking_age_selected | 16 (4 users) | 16 (4 users) | — |
| booking_modal_open | 7 (4 users) | **10 (5 users)** | +3 events, +1 user |
| booking_date_selected | 5 (2 users) | 6 (2 users) | +1 event |
| booking_confirm_pay_click | 5 (3 users) | 6 (3 users) | +1 event |
| booking_submit_error | 0 | **1 (1 user)** | **FIRST EVER** |
| booking_submit_success | 0 | 0 | — |

**Today (March 25)**: A user opened the booking modal and **attempted
to submit a booking** — but got an error (`booking_submit_error`).

This is a breakthrough moment in the funnel data. This person got
further than anyone has before:
1. Opened the modal
2. Selected a payment method (past the previous 100% drop-off point)
3. Filled out the form fields
4. Hit submit
5. Got an error

**Yesterday (March 24, full data)**: More active than the partial day
showed — 3 modal opens, 2 confirm & pay clicks, 2 date selections from
a single user.

### Updated funnel user journey (all time)

| User | Date | Deepest step reached | Outcome |
|---|---|---|---|
| 1 | Mar 17 | Confirm & Pay → Modal | Abandoned at payment form |
| 2 | Mar 18 | Modal open | Abandoned immediately |
| 3 | Mar 19 | Modal open | Abandoned immediately |
| 4 | Mar 21 | Age selection (x8) | Abandoned at date selection |
| 5 | Mar 23 | Confirm & Pay (x3) → Modal (x3) | Abandoned at payment form |
| 6 | Mar 24 | Date (x2) → Confirm & Pay (x2) → Modal (x3) | Abandoned at payment form |
| **7** | **Mar 25** | **Modal → Submit** | **SUBMISSION ERROR** |

**3 out of 7** users reached the payment form and abandoned.
**1 out of 7** got past the payment form and tried to submit but hit an
error. **0 out of 7** completed successfully.

### The booking_submit_error needs investigation

The error event fires when the API call to `/v1/reservations` fails.
Possible causes:
- API endpoint is down or returning 500
- Turnstile captcha validation failed
- Required field validation failed server-side
- Network error during submission

This user was ready to pay. If the error is on the backend side, this
is a lost customer that should be recoverable.

### Top landing pages

| Page | Sessions | Bounce | Note |
|---|---|---|---|
| /en | 48 | 44% | Homepage — bounce improving |
| / | 30 | 70% | Root redirect |
| /en/easter-2026-montessori-play-coaching-workshop | **13** | 54% | Easter workshop surging |
| /easter-2026-montessori-play-coaching-workshop | **10** | 40% | Easter (non-locale) |
| /links | 5 | **0%** | Bio link — perfect |
| /en/links | 3 | **0%** | Bio link (en) — perfect |

Easter workshop pages combined: **23 sessions** (was 6 a week ago,
+283%). This event has significant organic interest.

---

## One-Week Summary (Mar 19 — Mar 25)

### Traffic growth

| Source | Mar 19 | Mar 25 | Growth |
|---|---|---|---|
| Total sessions | 80 | 169 | +111% |
| Google organic | 19 | 36 | +89% |
| Facebook referral | 9 | 16 | +78% |
| Instagram referral | 1 | 10 | +900% |
| Direct | 40 | 93 | +133% |

### Funnel progress

| Metric | Mar 19 | Mar 25 |
|---|---|---|
| Users who opened booking modal | 2 | 5 |
| Users who reached payment step | 1 | 3 |
| Users who attempted submission | 0 | **1** |
| Completed bookings | 0 | 0 |

### Actions taken this week

1. Meta ad set optimization: REACH → POST_ENGAGEMENT (18x efficiency)
2. Google Ads keywords: added 7 broader broad-match keywords
3. Google Ads bidding: Manual CPC → Maximize Clicks
4. GA4 audiences created (3 remarketing audiences)
5. GA4 eCommerce events added to codebase
6. GTM eCommerce tags created and published (v10)

### Immediate priorities

1. **Investigate the booking_submit_error** — this is a user who tried
   to pay. Check `/v1/reservations` endpoint logs.
2. **Launch Meta TRAFFIC campaign** — the engagement campaign proved the
   audience exists. Now drive them to the website.
3. **Fix payment form friction** — 3/3 users abandoned at the payment
   step before today's user finally got through.

---

## Data Integrity Notes

- Google Ads API queried via service account through MCC (544-581-2170).
- Meta Marketing API queried via system user token.
- GA4 Data API queried via service account for property 525520074.
- All queries read-only. No changes made to any platform.
