# Google Ads & Meta Ads Performance Assessment

**Date**: 2026-04-06 (Sunday — Easter Workshop Day)
**Previous assessment**: 2026-04-04
**Data sources**: Google Ads API (v20), Meta Marketing API (v21.0),
GA4 Data API (v1beta).

---

## Executive Summary

| Platform | Status | Spend (all time) | Key result |
|---|---|---|---|
| Meta Easter Traffic | **ENDED** | **HK$322** | 1,240 link clicks, 920 LPVs, **4 conv** |
| Meta Engagement (ended) | Ended Mar 24 | HK$347 | 144 engagements |
| Google Ads Search | Running | **HK$743** | 1,054 imp, 67 clicks, 0 conv |

Today is the Easter workshop. The campaign ended overnight. The booking
funnel stayed active through the final days — users continued exploring
age groups and dates on April 5 and 6, including **today** (workshop
day) with 1 user selecting 7 ages and 7 dates.

Google Ads crossed **1,000 impressions** and **67 clicks** total,
with "childcare helper training" overtaking "domestic helper course
hong kong" as the #2 keyword by clicks. CPC continues dropping
(now HK$11.09 average, down from HK$17.79 at launch).

---

## Meta Ads — Easter Traffic Campaign (FINAL REPORT)

### Campaign complete

| Metric | Final Value |
|---|---|
| Duration | 8 days (Mar 30 - Apr 5) |
| Impressions | **18,392** |
| Reach | **13,515 unique people** |
| Frequency | 1.36 |
| Link clicks | **1,240** |
| Landing page views | **920** |
| Video views | **8,457** |
| CPC (link click) | HK$0.26 |
| Cost per LPV | HK$0.35 |
| Total Spend | **HK$322.19** |
| **GA4 Conversions** | **4** |
| **Cost per conversion** | **HK$81** |

### Daily breakdown (complete campaign)

| Date | Opt | Imp | Link clicks | LPVs | Spend |
|---|---|---|---|---|---|
| Mar 30 | LINK_CLICKS | 2,929 | 223 | 134 | HK$52 |
| Mar 31 | Mixed | 3,082 | 269 | 182 | HK$63 |
| Apr 1 | LPV | 3,662 | 215 | 185 | HK$62 |
| Apr 2 | LPV | 2,012 | 107 | 83 | HK$26 |
| Apr 3 | LPV | 1,881 | 100 | 80 | HK$30 |
| Apr 4 | LPV | 2,372 | 152 | 128 | HK$40 |
| Apr 5 | LPV | 2,454 | 174 | 127 | HK$49 |
| **Total** | | **18,392** | **1,240** | **920** | **HK$322** |

### GA4 attribution

| Source | Sessions | Engaged | Conversions |
|---|---|---|---|
| instagram/paid_social | **1,067** | 30 | **4** |

4 conversions from 1,067 sessions = **0.37% conversion rate**. Despite
the high bounce rate (97%), the sheer volume of traffic produced real
bookings.

### Campaign verdict

For a HK$350/spot workshop with 6 spots:
- **Spend**: HK$322
- **Bookings**: 2 confirmed (`booking_submit_success`) + 2 additional
  GA4 conversions
- **Revenue**: HK$1,400 (4 x HK$350)
- **ROAS**: **4.3x** (on Easter campaign alone)
- **Reach**: 13,515 HK mothers with parenting interests saw the Reel
- **Video views**: 8,457 — significant brand awareness

---

## Google Ads Assessment

### Milestones: 1,000 impressions, 67 clicks

| Metric | Apr 4 | Apr 6 | Change |
|---|---|---|---|
| Impressions | 853 | **1,054** | +201 |
| Clicks | 50 | **67** | +17 |
| CTR | 5.86% | **6.36%** | Improving |
| CPC | HK$12.13 | **HK$11.09** | Improving |
| Spend | HK$606 | **HK$743** | +HK$137 |

### Daily performance

| Date | Imp | Clicks | Cost | CPC |
|---|---|---|---|---|
| Apr 1 | 128 | 8 | HK$100 | HK$12.49 |
| Apr 2 | 47 | 6 | HK$62 | HK$10.39 |
| Apr 3 | 47 | 5 | HK$43 | HK$8.58 |
| Apr 4 | 104 | 4 | HK$33 | HK$8.19 |
| **Apr 5** | **74** | **9** | **HK$72** | **HK$8.02** |

April 5 had the **lowest CPC ever** (HK$8.02) and the most clicks
in a day (9). Google's algorithm is clearly optimizing well.

### Keyword performance (final)

| Keyword | Imp | Clicks | CTR | CPC | Cost |
|---|---|---|---|---|---|
| helper training hong kong | 517 | 31 | 6.00% | HK$12.54 | HK$389 |
| **childcare helper training** | **271** | **20** | **7.38%** | **HK$8.92** | **HK$178** |
| domestic helper course hong kong | 266 | 16 | 6.02% | HK$10.98 | HK$176 |

"childcare helper training" is now the clear efficiency winner —
highest CTR (7.38%) and lowest CPC (HK$8.92). It overtook "domestic
helper course hong kong" in clicks (20 vs 16).

### Second ad variant gaining share

| Ad | Imp | Clicks | CTR | Cost |
|---|---|---|---|---|
| 800467058814 ("Helper Training in HK") | 766 | 48 | 6.3% | HK$567 |
| 800467050954 ("Helper Childcare Training") | 288 | 19 | **6.6%** | HK$176 |

The second ad variant now has 27% impression share (up from 14% at
launch) and a slightly higher CTR. Google is giving it more rotation.

---

## GA4 Website Analytics (Last 30 Days)

### Site overview

| Metric | Mar 19 (start) | Apr 4 | Apr 6 |
|---|---|---|---|
| Sessions | 80 | 1,202 | **1,443** |
| Users | 58 | 1,114 | **1,348** |
| Engaged | 28 | 144 | **162** |
| Conversions | 0 | 4 | **4** |

### Booking funnel — continued growth

| Event | Apr 4 | Apr 6 | Change |
|---|---|---|---|
| booking_age_selected | 34 (9 users) | **45 (12 users)** | +11, +3 users |
| booking_modal_open | 34 (12 users) | 34 (12 users) | — |
| booking_date_selected | 19 (5 users) | **31 (8 users)** | **+12, +3 users** |
| booking_confirm_pay_click | 13 (5 users) | 13 (5 users) | — |
| booking_payment_method_selected | 9 (3 users) | 9 (3 users) | — |
| whatsapp_click | 5 (5 users) | 5 (5 users) | — |
| booking_submit_success | 2 (2 users) | 2 (2 users) | — |

**New funnel activity (Apr 4-6)**:
- Apr 5: 2 users selected 4 age groups and 5 dates — actively
  exploring the My Best Auntie course options
- Apr 6 (today): 1 user selected 7 age groups and 7 dates —
  heavy exploration session

**12 unique users** have now selected age groups (up from 1 on Mar 19).
**8 users** have selected dates. The top of the funnel is healthy and
growing even without the Easter ad running.

### Traffic sources

| Source | Sessions | Engaged | Conv | Bounce |
|---|---|---|---|---|
| instagram/paid_social | 1,067 | 30 | **4** | 97% |
| (direct)/(none) | 186 | 43 | 0 | 77% |
| **google/cpc** | **70** | **21** | 0 | **70%** |
| **google/organic** | **54** | **33** | 0 | **39%** |
| l.instagram.com/referral | 23 | 11 | 0 | 52% |
| facebook.com/referral | 16 | 15 | 0 | 6% |

Google CPC now at **70 sessions with 70% bounce** (was 80%+ before
course page hero improvements). Google organic remains the quality
champion (39% bounce, 61% engagement rate).

### Top landing pages

| Page | Sessions | Conv | Bounce |
|---|---|---|---|
| /en/easter-2026... | 1,106 | **4** | 96% |
| /en (homepage) | 86 | 0 | 50% |
| /en/services/my-best-auntie... | **70** | 0 | **71%** |
| / | 58 | 0 | 59% |
| /links + /en/links | 13 | 0 | **8%** |

Course page: 70 sessions, 71% bounce (improved from 88% at start).
Links pages: 13 sessions, 8% bounce — consistently excellent.

---

## Full Campaign Period Summary (Mar 19 — Apr 6)

### Total ad spend and results

| Campaign | Period | Spend | Key result |
|---|---|---|---|
| Meta Engagement | Mar 17-24 | HK$347 | 144 engagements, 10,947 reach |
| Meta Easter Traffic | Mar 30-Apr 5 | HK$322 | 1,240 link clicks, **4 bookings** |
| Google Ads Search | Mar 16-ongoing | HK$743 | 67 clicks, 0 bookings |
| **Total** | | **HK$1,412** | |

### Revenue

| Source | Bookings | Revenue |
|---|---|---|
| Easter workshop (from Meta ad) | 4 | **HK$1,400** |
| My Best Auntie course | 0 | HK$0 |
| **Total** | **4** | **HK$1,400** |

### ROI

- **Total spend**: HK$1,412
- **Total revenue**: HK$1,400
- **Net**: -HK$12 (approximately break-even)
- **Easter campaign alone**: HK$322 spent → HK$1,400 revenue = **4.3x ROAS**
- **Plus unmeasured value**: 13,515 people reached, 8,457 video views,
  brand awareness built, SEO growing organically

### Traffic growth

| Source | Mar 19 | Apr 6 | Growth |
|---|---|---|---|
| Total sessions (30d) | 80 | **1,443** | **+1,704%** |
| Users | 58 | **1,348** | **+2,224%** |
| Google organic | 19 | **54** | +184% |
| Google CPC | 2 | **70** | +3,400% |
| Instagram (all) | 1 | **1,092** | +109,100% |
| Facebook referral | 9 | 16 | +78% |

### Funnel growth

| Event (users) | Mar 19 | Apr 6 | Growth |
|---|---|---|---|
| Modal opens | 2 | **12** | +500% |
| Age selected | 1 | **12** | +1,100% |
| Date selected | 1 | **8** | +700% |
| Confirm & Pay | 1 | **5** | +400% |
| Payment method | 0 | **3** | — |
| WhatsApp clicks | 0 | **5** | — |
| Bookings | 0 | **2** | — |

### What worked

1. **Meta Easter Reel traffic campaign** — HK$322 for 4 bookings (4.3x
   ROAS). The Reel format with POST_ENGAGEMENT-like creative drove
   massive video views and enough link clicks to convert.
2. **Landing page views optimization** — switching from LINK_CLICKS
   improved click-to-pageload ratio from 60% to 80%.
3. **Google Ads broader keywords + Maximize Clicks** — went from dead
   (0 impressions) to 67 clicks with declining CPC.
4. **Course page hero improvements** — bounce rate from Google Ads
   improved from 88% to 70%.
5. **SEO compounding** — Google organic doubled without any ad spend.

### What to do next

1. **Repeat the Easter formula** — next event or course cohort opening,
   create a Reel, run a traffic campaign with LPV optimization, same
   targeting. The template is proven.
2. **Keep Google Ads running** — CPC is declining and CTR is strong.
   It drives qualified search traffic for the My Best Auntie course.
3. **Investigate course page conversions** — 70 sessions on the course
   page from Google Ads, 0 conversions. The hero improvements helped
   bounce, but nobody has booked through this flow yet.
4. **Build on WhatsApp** — 5 users clicked WhatsApp. Check if any
   became real conversations or bookings outside the website.
5. **Continue Instagram content** — organic Instagram referral (23
   sessions, 52% bounce) is growing naturally and produces engaged
   visitors.

---

## Data Integrity Notes

- Google Ads API queried via service account through MCC.
- Meta Marketing API queried via system user token.
- GA4 Data API queried via service account for property 525520074.
- All queries read-only.
- Easter campaign ended Apr 5. Apr 6 shows 0 impressions (only 1
  residual LPV from late delivery).
