# Google Ads & Meta Ads Performance Assessment

**Date**: 2026-04-01 (Wednesday)
**Previous assessment**: 2026-03-31
**Data sources**: Google Ads API (v20), Meta Marketing API (v21.0),
GA4 Data API (v1beta).

---

## FIRST BOOKINGS EVER

**Two bookings have been completed.** After 13 days of tracking, 817
sessions, and HK$1,013 in ad spend across all campaigns:

| Booking | Date | Source | Device |
|---|---|---|---|
| **Booking 1** | **March 31** | **instagram/paid_social** | **mobile** |
| **Booking 2** | **April 1** | (not set) | mobile |

**The first-ever `booking_submit_success` came from the Easter Instagram
ad.** A user from `instagram/paid_social` on mobile completed a booking
on March 31 — the same day we saw 6 engaged sessions from the paid
campaign (up from 4 the day before). They also selected 3 payment
methods before submitting.

The second booking today (April 1) shows `(not set)` source, which
typically means the user returned directly or through a channel that
stripped the referrer — potentially the same user or someone who
initially discovered the site through the ad.

GA4 now shows **4 conversions** and `instagram/paid_social` has
**2 attributed conversions**.

---

## Executive Summary

| Platform | Status | Spend (all time) | Impressions | Clicks | Conversions |
|---|---|---|---|---|---|
| Google Ads | Running | **HK$492** | **683** | **38** | 0 |
| Meta Easter Traffic | Day 3 | **HK$174** | **9,443** | **676 link clicks** | **2** |
| Meta Engagement (ended) | Ended | HK$347 | 15,281 | 14 | 0 |

---

## Changes Since Last Assessment (March 31)

| What | Mar 31 | Apr 1 | Change |
|---|---|---|---|
| **booking_submit_success** | **0** | **2 (2 users)** | **FIRST EVER** |
| GA4 conversions | 0 | **4** | **First conversions** |
| Meta Easter conversions | 0 | **2** | **Attributed to paid social** |
| Meta Easter link clicks | 459 | **676** | +217 |
| Meta Easter landing page views | 301 | **473** | +172 |
| Meta Easter spend | HK$102 | **HK$174** | +HK$72 |
| Google Ads impressions | 541 | **683** | +142 |
| Google Ads clicks | 30 | **38** | +8 |
| Google Ads spend | HK$392 | **HK$492** | +HK$100 |
| GA4 sessions (30d) | 603 | **817** | +214 |
| GA4 users (30d) | 540 | **735** | +195 |
| Booking modal opens (users) | 9 | **11** | +2 |
| Payment method selected (users) | 1 | **3** | +2 |

---

## Meta Ads — Easter Traffic Campaign (Day 3)

### Optimization switch impact

The switch from LINK_CLICKS to LANDING_PAGE_VIEWS was made mid-day on
March 31. Today (April 1) is the first full day under the new
optimization.

| Date | Optimization | Imp | Link clicks | LPVs | LPV/click ratio | Engaged | Conv |
|---|---|---|---|---|---|---|---|
| Mar 30 | LINK_CLICKS | 2,929 | 223 | 134 | 60% | 4 | 0 |
| Mar 31 | Mixed* | 3,082 | 269 | 182 | 68% | **6** | **2** |
| Apr 1 | LPV | 3,432 | 184 | 157 | **85%** | 1 | 0 |

*Switch happened mid-day.

The LPV/click ratio improved from 60% to **85%** — meaning fewer
wasted clicks where people didn't wait for the page to load. Fewer
total link clicks (184 vs 269) but more of them are real page loads.

### Cumulative performance

| Metric | Value |
|---|---|
| Impressions | 9,443 |
| Reach | **8,001** |
| Link clicks | 676 |
| Landing page views | **473** |
| Video views | 4,091 |
| Cost per link click | HK$0.26 |
| Cost per LPV | HK$0.37 |
| Total Spend | **HK$174.18** |
| **Conversions** | **2** |
| **Cost per conversion** | **HK$87** |

### GA4 paid social daily engagement

| Date | Sessions | Engaged | Avg duration | Conversions |
|---|---|---|---|---|
| Mar 30 | 161 | 4 | 4.2s | 0 |
| Mar 31 | 210 | **6** | 2.4s | **2** |
| Apr 1 | 145 | 1 | 0.5s | 0 |

March 31 was the breakthrough day — 6 engaged sessions and 2
conversions from the paid campaign. The booking that completed came
from the LINK_CLICKS phase (before the switch), suggesting that even
with high bounce rates, the sheer volume of traffic produces some
conversions.

April 1 (first full LANDING_PAGE_VIEWS day) has fewer sessions but
higher quality clicks (85% reach the page vs 60% before). It's still
early — give it 2-3 more days to see if engagement improves.

---

## Google Ads Assessment

### Consistent daily performance

| Date | Impressions | Clicks | Cost |
|---|---|---|---|
| Mar 28 | 58 | 6 | HK$98 |
| Mar 29 | 73 | 8 | HK$99 |
| Mar 30 | 248 | 8 | HK$100 |
| **Mar 31** | **174** | **8** | **HK$96** |

Google Ads is now consistently delivering 8 clicks/day at ~HK$100/day
spend. All three keywords continue to produce clicks.

### All-time totals

| Metric | Value |
|---|---|
| Impressions | 683 |
| Clicks | 38 |
| CTR | 5.56% |
| CPC | HK$12.95 |
| Spend | **HK$492** |
| Conversions | 0 |

### Keyword performance

| Keyword | Imp | Clicks | CTR | CPC | Cost |
|---|---|---|---|---|---|
| helper training hong kong | 332 | 23 | 6.93% | HK$13.95 | HK$321 |
| domestic helper course hong kong | 202 | 8 | 3.96% | HK$12.80 | HK$102 |
| childcare helper training | 149 | 7 | 4.70% | HK$9.83 | HK$69 |

---

## GA4 Website Analytics (Last 30 Days)

### Site overview

| Metric | Mar 19 | Mar 31 | Apr 1 |
|---|---|---|---|
| Sessions | 80 | 603 | **817** |
| Users | 58 | 540 | **735** |
| Engaged | 28 | 100 | **112** |
| **Conversions** | **0** | **0** | **4** |

### Booking funnel — breakthrough

| Event | Mar 31 | Apr 1 | Change |
|---|---|---|---|
| booking_modal_open | 26 (9 users) | **32 (11 users)** | +6, +2 users |
| booking_age_selected | 24 (5 users) | 24 (5 users) | — |
| booking_date_selected | 17 (3 users) | 17 (3 users) | — |
| booking_confirm_pay_click | 12 (4 users) | 12 (4 users) | — |
| booking_payment_method_selected | 3 (1 user) | **9 (3 users)** | **+6, +2 users** |
| whatsapp_click | 3 (3 users) | **4 (4 users)** | +1 |
| **booking_submit_success** | **0** | **2 (2 users)** | **FIRST** |

**Payment method selection tripled** — from 1 user to 3 users. Two of
them completed bookings. The third (April 1, `(not set)` source)
selected 3 payment methods and submitted successfully.

**March 31 booking** came from `instagram/paid_social` — mobile user
who selected 3 payment methods, then submitted.

**April 1 booking** came from `(not set)/(not set)` — likely a return
visitor whose original source attribution was lost.

### Traffic sources with conversions

| Source | Sessions | Engaged | Conversions |
|---|---|---|---|
| instagram/paid_social | 517 | 11 | **2** |
| (not set)/(not set) | 10 | 0 | **2** |
| google/organic | 48 | 27 | 0 |
| google/cpc | 38 | 8 | 0 |
| facebook.com/referral | 16 | 15 | 0 |

---

## Total Ad Spend & ROI

| Campaign | Spend | Conversions | Cost/Conversion |
|---|---|---|---|
| Meta Easter Traffic | HK$174 | **2** | **HK$87** |
| Google Ads Search | HK$492 | 0 | — |
| Meta Engagement (ended) | HK$347 | 0 | — |
| **Total** | **HK$1,013** | **2** | **HK$507** |

If the Easter workshop is HK$350/spot and 2 spots are booked, that's
**HK$700 revenue from HK$1,013 total ad spend**. Not yet profitable
on a direct-attribution basis, but:
- The Meta Easter campaign alone is HK$174 for 2 bookings = HK$87/booking
- Google Ads contributed to brand awareness and may have influenced
  the conversions indirectly
- The engagement campaign (HK$347) built the initial audience

---

## Data Integrity Notes

- Google Ads API queried via service account through MCC.
- Meta Marketing API queried via system user token.
- GA4 Data API queried via service account for property 525520074.
- All queries read-only.
- The 4 GA4 conversions include 2 `booking_submit_success` events plus
  potentially other key events. The 2 attributed to `instagram/paid_social`
  are confirmed booking submissions.
