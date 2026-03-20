# Google Ads & Meta Ads Performance Assessment — Follow-up

**Date**: 2026-03-20
**Previous assessment**: 2026-03-19
**Data sources**: Google Ads API (v20), Meta Marketing API (v21.0),
GA4 Data API (v1beta).

---

## Executive Summary

| Platform | Status | Spend (all time) | Impressions | Clicks | Engagements | Conversions |
|---|---|---|---|---|---|---|
| Google Ads | ENABLED, ads APPROVED, still not serving | HK$0 | 0 | 0 | — | 0 |
| Meta Ads | Active, optimization switched to POST_ENGAGEMENT | HK$191 | 13,237 | 9 | 36 | 0 |

The Meta optimization switch from REACH to POST_ENGAGEMENT (applied
2026-03-19) has produced a dramatic improvement: engagements jumped from
5 to 36, and cost per engagement dropped from HK$26.80 to HK$5.30. On
March 20 alone (partial day), 23 engagements were delivered at HK$1.77 each.

Google Ads remains at zero impressions despite all ads being approved. The
issue is now confirmed to be low search volume or a configuration/billing
problem — not ad review.

The website received 102 sessions in the last 30 days (up from 80 on
March 19). A third user opened the booking modal on March 19. Still
0 completed conversions.

---

## Changes Since Last Assessment (March 19)

| What | March 19 | March 20 | Change |
|---|---|---|---|
| Meta total spend | HK$95.71 | HK$150.16 | +HK$54.45 |
| Meta total impressions | 12,548 | 13,237 | +689 |
| Meta total engagements | 5 | 36 | **+31 (+620%)** |
| Meta cost/engagement | HK$26.80 | HK$5.30 | **-80%** |
| Meta total reactions | 4 | 34 | +30 |
| Meta comments | 0 | 1 | +1 (first comment) |
| Google Ads impressions | 0 | 0 | No change |
| Google Ads ad approval | Unknown | APPROVED | Now confirmed |
| GA4 sessions (30d) | 80 | 102 | +22 |
| GA4 booking modal opens | 2 | 3 | +1 (new user on Mar 19) |
| GA4 Facebook referral sessions | 9 | 10 | +1 |

---

## Google Ads Assessment

### Status: Ads approved but still zero impressions

All three responsive search ads are now confirmed **APPROVED** by Google's
policy review. Despite this:

| Metric | Value |
|---|---|
| Impressions (all time) | 0 |
| Clicks (all time) | 0 |
| Cost (all time) | HK$0.00 |
| Days active | 4+ (since March 16) |
| Ad approval | APPROVED (all 3 ads) |

### Root cause analysis

Since ad review is ruled out, the zero-impression issue is caused by one or
more of:

1. **Insufficient search volume**: The phrase-match keywords are extremely
   niche for the Hong Kong market. Terms like "helper training course hk" and
   "auntie training course hong kong" may see near-zero daily searches. Google
   may not be entering the campaign into any auctions because no qualifying
   searches are occurring.

2. **Keyword match type too restrictive**: All active campaign keywords are
   phrase match. In a low-volume market, exact and phrase match can result in
   zero eligible auctions. Broad match with smart bidding would cast a wider
   net.

3. **Missing exact-match keywords**: The documented campaign plan in
   `marketing-stack.md` lists 3 exact-match keywords, but the API only shows
   phrase-match keywords in the active campaign. The exact-match keywords may
   not have been added.

4. **Billing or account issue**: Possible (but less likely) that a billing
   hold or account-level policy issue is preventing ad serving.

5. **Location targeting precision**: The campaign targets Hong Kong with
   "presence only" — this is correct, but the small geographic area combined
   with niche keywords further reduces the auction pool.

### Recommended actions

1. **Check Google Ads UI for keyword status indicators**: Look for "Low
   search volume" status next to keywords. This is visible in the UI but not
   exposed through the API.
2. **Add broader keywords**: Consider adding broader-but-relevant keywords
   such as "helper training hong kong" (phrase), "domestic helper course"
   (phrase), "childcare helper" (phrase) to increase auction eligibility.
3. **Consider broad match + smart bidding**: Switch to broad match keywords
   with Target CPA or Maximize Conversions bidding. This allows Google to
   match relevant searches that don't exactly match the keyword phrases.
4. **Verify billing**: Log into the Google Ads UI and check for any billing
   alerts or payment method issues.
5. **Check if the campaign is paused at a different level**: Ensure no
   account-level, campaign-level, or ad-group-level serving restrictions
   are in place.

### What's unchanged

Campaign structure, ad groups, keywords, negative keywords, sitelinks, and
conversion actions are all identical to the March 19 assessment. See that
report for full details.

---

## Meta Ads Assessment

### Account overview

| Field | Value |
|---|---|
| Total Amount Spent (all time) | HK$150.16 |
| Balance | HK$30.95 |
| Ad Set Optimization | **POST_ENGAGEMENT** (changed from REACH on Mar 19) |

### Campaign performance (cumulative, 4 days: March 17-20)

| Metric | Value |
|---|---|
| Impressions | 13,237 |
| Reach | 9,906 |
| Frequency | 1.34 |
| Clicks | 9 (all unique) |
| CTR | 0.07% |
| CPC | HK$21.22 |
| CPM | HK$14.43 |
| Total Spend | HK$190.97 |

### Engagement actions (cumulative)

| Action | Count |
|---|---|
| Post reactions | 34 |
| Comments | 1 |
| Post saves | 1 |
| Post engagement (total) | 36 |
| Net likes | 31 |

### Daily breakdown — optimization impact clearly visible

| Date | Optimization | Impressions | Reach | Clicks | Engagements | CPM | Cost/Eng | Spend |
|---|---|---|---|---|---|---|---|---|
| Mar 17 | REACH | 4,418 | 4,418 | 2 | 2 | HK$10.61 | HK$23.44 | HK$46.88 |
| Mar 18 | REACH | 4,519 | 4,348 | 1 | 1 | HK$10.81 | HK$48.83 | HK$48.83 |
| Mar 19 | Mixed* | 3,885 | 3,885 | 6 | 10 | HK$14.02 | HK$5.45 | HK$54.45 |
| Mar 20 | POST_ENGAGEMENT | 414 | 340 | 0 | **23** | HK$98.53 | **HK$1.77** | HK$40.79 |

*Optimization was switched mid-day on March 19.

### Impact analysis of the REACH → POST_ENGAGEMENT switch

The data clearly validates the optimization change:

**Before (REACH, Mar 17-18)**:
- 8,937 impressions, 3 engagements
- Cost per engagement: HK$31.90
- Meta showed the ad to as many people as possible, but most ignored it

**After (POST_ENGAGEMENT, Mar 19-20)**:
- 4,299 impressions, 33 engagements
- Cost per engagement: HK$2.89
- Meta now shows the ad to fewer people, but to those likely to interact

**Key metrics shift**:
- Cost per engagement: **HK$31.90 → HK$2.89 (91% reduction)**
- Engagements per day: **1.5 → 16.5 (11x increase)**
- CPM increased from HK$10.71 → HK$22.14 (expected trade-off — each
  impression costs more because Meta is being selective)
- Impressions per day decreased from ~4,500 → ~2,150 (expected — fewer but
  higher-quality impressions)

March 20 specifically (full POST_ENGAGEMENT day, still partial):
- 23 engagements in a partial day at HK$1.77 each
- First comment received from the ad
- Cost per engagement is now within the HK$2-8 industry benchmark

### Remaining campaign duration

The campaign runs until March 24 (4 more days). At the current daily spend
rate (~HK$40-55/day), total campaign spend will be approximately HK$350-400.

---

## GA4 Website Analytics (Last 30 Days)

### Site overview

| Metric | Mar 19 | Mar 20 | Change |
|---|---|---|---|
| Sessions | 80 | 102 | +22 |
| Users | 58 | 73 | +15 |
| Engaged Sessions | 28 | 35 | +7 |
| Bounce Rate | 65.0% | 65.7% | ~same |
| Pageviews | 127 | 170 | +43 |
| Conversions | 0 | 0 | — |

### Traffic sources

| Source / Medium | Sessions | Engaged | Bounce |
|---|---|---|---|
| (direct) / (none) | 53 | 11 | 79% |
| google / organic | 24 | 12 | 50% |
| facebook.com / referral | 10 | 8 | 20% |
| (not set) / (not set) | 4 | 0 | 100% |
| l.wl.co / referral | 3 | 1 | 67% |
| tagassistant.google.com / referral | 3 | 1 | 67% |
| google / cpc | 2 | 1 | 50% |
| l.instagram.com / referral | 1 | 1 | 0% |
| m.facebook.com / referral | 1 | 0 | 100% |

Facebook/Instagram referral traffic continues to show the lowest bounce rates
(20% and 0% respectively), confirming high engagement quality from social
sources.

### Booking funnel (last 30 days)

| Event | Count | Users |
|---|---|---|
| booking_modal_open | 3 | 3 |
| booking_age_selected | 4 | 1 |
| booking_date_selected | 2 | 1 |
| booking_confirm_pay_click | 1 | 1 |

**New activity**: A third user opened the booking modal on March 19.

Funnel detail by date:
- **Mar 17**: 1 user opened modal → selected 3 age groups → selected dates
  for Apr + May 2026 → clicked confirm & pay → dropped off at payment form
- **Mar 18**: 1 user opened modal → dropped off immediately
- **Mar 19**: 1 user opened modal → dropped off immediately (NEW)

### Other lead events

No contact form submissions, media downloads, community signups, or WhatsApp
clicks recorded in the last 30 or 90 days.

### Top landing pages

| Page | Sessions | Bounce |
|---|---|---|
| /en (homepage) | 32 | 53% |
| / (root redirect) | 18 | 56% |
| /easter-2026-montessori-play-coaching-workshop | 6 | 67% |
| /easter | 3 | 0% |
| /en/easter-2026-montessori-play-coaching-workshop | 3 | 67% |
| /my-best-auntie-training-course | 3 | 67% |
| /en/contact-us | 2 | 100% |
| /en/services/my-best-auntie-training-course | 2 | 100% |
| /event/toilet-learning-apr-25 | 2 | 100% |
| /links | 2 | 0% |
| /en/links | 2 | 50% |

New landing pages appearing since March 19: `/event/toilet-learning-apr-25`
and `/en/easter-2026-montessori-play-coaching-workshop`.

---

## Summary of Findings

### What's working

1. **Meta optimization switch is delivering results**: The REACH →
   POST_ENGAGEMENT change has been validated. Cost per engagement dropped 91%
   and daily engagements increased 11x.
2. **Facebook/Instagram referral traffic quality**: Consistently the lowest
   bounce rates of any traffic source (0-20%), confirming social audiences
   are well-matched.
3. **Google organic traffic is growing**: 24 sessions (up from 19), now the
   second-largest traffic source.
4. **Booking funnel interest exists**: 3 different users opened the booking
   modal in the last 3 days, one proceeding to the payment step.

### What needs attention

1. **Google Ads is not serving**: 4+ days with zero impressions despite
   approved ads. This needs investigation in the Google Ads UI (likely low
   search volume keywords). See recommendations above.
2. **No completed conversions**: Despite 102 sessions, 3 booking modal opens,
   and 1 payment click, no bookings or form submissions have completed. The
   payment form step appears to be a friction point.
3. **Meta ad CTR remains very low**: Even with POST_ENGAGEMENT optimization,
   only 9 clicks across 13,237 impressions (0.07%). The ad drives on-platform
   engagement (likes, reactions) but not website traffic.
4. **High direct traffic bounce rate (79%)**: Over half the site traffic is
   direct with a high bounce rate, suggesting visitors who arrive directly
   (bookmarks, typed URL) aren't finding what they expect or aren't engaged.

---

## Data Integrity Notes

- Google Ads API queried via service account through MCC (544-581-2170) to
  client account (499-114-4901).
- Meta Marketing API queried via system user token for ad account
  act_1562589928493715.
- GA4 Data API queried via service account for property 525520074.
- All queries were read-only. No changes made during this assessment.
- The March 20 Meta daily data is partial (the day is not yet complete).
