# Google Ads & Meta Ads Performance Assessment

**Date**: 2026-03-19
**Scope**: Read-only assessment of live ad performance across Google Ads and
Meta Ads, cross-referenced with GA4 website analytics.
**Data sources**: Google Ads API (v20), Meta Marketing API (v21.0),
GA4 Data API (v1beta).

---

## Executive Summary

Both ad platforms are in very early stages with minimal spend and no
conversions yet.

| Platform | Status | Spend (all time) | Impressions | Clicks | Conversions |
|---|---|---|---|---|---|
| Google Ads | Campaign enabled but not serving | HK$0 | 0 | 0 | 0 |
| Meta Ads | Active Instagram boost (3 days old) | HK$134 | 12,548 | 9 | 0 |

The website received 80 sessions in the last 30 days with 0 completed
conversions (though 2 booking modal opens and 1 payment click were recorded).

---

## Google Ads Assessment

### Account details

| Field | Value |
|---|---|
| Manager (MCC) Account | 544-581-2170 |
| Client Account | 499-114-4901 (Evolve Sprouts) |
| Currency | HKD |
| Timezone | Asia/Hong_Kong |
| Status | ENABLED |

### Campaigns

| Campaign | Status | Channel | Budget | Bidding | Start |
|---|---|---|---|---|---|
| Campaign #1 | REMOVED | Search | HK$50/day | Target Spend | 2026-03-16 |
| My Best Auntie — Search — HK | ENABLED | Search | HK$50/day | Manual CPC (HK$20) | 2026-03-16 |

"Campaign #1" was a test campaign that has been removed. The active campaign
is "My Best Auntie — Search — HK".

### Performance: My Best Auntie — Search — HK

**All-time metrics (since 2026-03-16):**

| Metric | Value |
|---|---|
| Impressions | 0 |
| Clicks | 0 |
| Cost | HK$0.00 |
| Conversions | 0 |

**Finding**: Despite being ENABLED since March 16, the campaign has recorded
zero impressions. This likely indicates one or more of:

1. **Ads pending review** — Responsive search ads typically take 1-3 business
   days for Google's policy review. Created on March 16 (a Sunday), review
   may still be processing.
2. **Low search volume** — The HK market for these specific keyword queries
   may have very low daily volume. Phrase-match keywords like "helper training
   course hk" and "auntie training course hong kong" are highly niche.
3. **Bidding below auction threshold** — HK$20 manual CPC may be below the
   effective floor for some keywords, though this is unlikely for such niche
   terms.

However, GA4 recorded 2 sessions from `google / cpc` in the last 30 days,
suggesting some minimal ad delivery may have occurred that isn't yet reflected
in the API reporting (possibly due to data processing lag).

### Ad groups

| Ad Group | Campaign | CPC Bid | Status |
|---|---|---|---|
| Ad group 1 | Campaign #1 (removed) | HK$0.01 | ENABLED |
| Helper Training Course | My Best Auntie — Search — HK | HK$20.00 | ENABLED |

### Ads (Responsive Search Ads)

**Ad 1** (in My Best Auntie — Search — HK):
- Headlines: "Helper Childcare Training HK", "My Best Auntie Course",
  "Montessori Helper Training", "Train Your Helper Today",
  "9-Week Practical Programme" (+ more)
- Final URL: `evolvesprouts.com/en/services/my-best-auntie-training-course/`

**Ad 2** (in My Best Auntie — Search — HK):
- Headlines: "Helper Training in Hong Kong", "My Best Auntie Programme",
  "Montessori Childcare Course", "Your Helper Transformed",
  "3 Home Visits Included" (+ more)
- Final URL: `evolvesprouts.com/en/services/my-best-auntie-training-course/`

### Keywords

**Active campaign keywords (phrase match)**:
- "helper training course hk"
- "auntie training course hong kong"
- "montessori helper training hong kong"
- "domestic helper childcare course"
- "train my helper hong kong"
- "helper parenting course hong kong"
- "domestic helper training course hong kong"
- "helper childcare training hong kong"

All keywords show 0 impressions and no quality scores (insufficient data).

**Note**: The removed "Campaign #1" also contains 25 broad-match generic
keywords ("child development", "childcare services", "preschools near me",
etc.) which are far too generic for this business. These keywords are dormant
since the campaign was removed.

### Negative keywords (properly configured)

"free", "job", "visa", "immigration", "cleaning", "placement", "agency",
"salary", "maid", "FDH employment" — all broad match.

### Sitelink extensions

| Sitelink | URL |
|---|---|
| Contact Us | evolvesprouts.com/en/contact-us/ |
| About the Founder | evolvesprouts.com/en/about-us/ |
| Upcoming Events | evolvesprouts.com/en/events/ |

### Conversion tracking

| Conversion Action | Type | Category | Status |
|---|---|---|---|
| GA4 - Booking Submit Success | Webpage | Purchase | ENABLED (primary) |
| GA4 - Contact Form Submit Success | Webpage | Lead form | ENABLED (secondary) |
| Evolve Sprouts Website purchase | GA4 auto | Purchase | HIDDEN |
| Evolve Sprouts Website contact_form_submit_success | GA4 auto | Default | HIDDEN |
| Evolve Sprouts Website media_form_submit_success | GA4 auto | Default | HIDDEN |
| Evolve Sprouts Website community_signup_submit_success | GA4 auto | Default | HIDDEN |
| Evolve Sprouts Website booking_submit_success | GA4 auto | Default | HIDDEN |

Conversion tracking is properly set up with GA4-linked actions.

---

## Meta Ads Assessment

### Account details

| Field | Value |
|---|---|
| Ad Account | act_1562589928493715 (Evolve Sprouts) |
| Status | ACTIVE |
| Currency | HKD |
| Timezone | Asia/Hong_Kong |
| Total Amount Spent | HK$95.71 (all time) |
| Balance | HK$17.71 |
| Created | 2025-09-30 |

### Active campaign

| Field | Value |
|---|---|
| Campaign | Instagram Boost — Organic Top Performers |
| Status | ACTIVE |
| Objective | OUTCOME_ENGAGEMENT |
| Buying Type | AUCTION |
| Running Period | 2026-03-17 to 2026-03-24 (7 days) |
| Daily Budget | HK$50.00 |

### Ad set: Boost — Easy ways to do less — HK Women 30-45

| Field | Value |
|---|---|
| Optimization Goal | REACH |
| Billing Event | IMPRESSIONS |
| Geo Targeting | Hong Kong |
| Age | 30-45 |
| Gender | Female |
| Interests | Parenting, Early childhood education, Montessori education, Child development |

### Ad performance (3 days: March 17-19, 2026)

| Metric | Value |
|---|---|
| Impressions | 12,548 |
| Reach | 9,346 |
| Frequency | 1.34 |
| Clicks | 9 |
| Unique Clicks | 7 |
| CTR | 0.07% |
| CPC | HK$14.89 |
| CPM | HK$10.68 |
| Total Spend | HK$133.99 |

### Engagement actions

| Action | Count |
|---|---|
| Post reactions | 4 |
| Post saves | 1 |
| Page engagement | 5 |
| Post engagement | 5 |

### Daily breakdown

| Date | Impressions | Reach | Clicks | CTR | Spend |
|---|---|---|---|---|---|
| 2026-03-17 | 4,418 | 4,418 | 2 | 0.045% | HK$46.88 |
| 2026-03-18 | 4,519 | 4,348 | 1 | 0.022% | HK$48.83 |
| 2026-03-19 | 3,611 | 3,575 | 6 | 0.166% | HK$38.28 |

### Key observations

1. **Very low CTR (0.07%)**: Industry average for Instagram engagement ads is
   typically 0.5-1.5%. At 0.07%, the ad creative or targeting may need
   adjustment.
2. **Reach is good**: 9,346 unique people reached in 3 days with only
   HK$134 spent. CPM of HK$10.68 is reasonable for Hong Kong.
3. **Frequency is healthy**: 1.34 means people are seeing the ad just over
   once — no ad fatigue issues.
4. **Click-through is minimal**: Only 9 total clicks (7 unique) across 12,548
   impressions. The ad is generating awareness but not driving action.
5. **No website conversions**: The engagement stays on Instagram; clicks are
   not translating to site visits or conversions.
6. **Optimization for reach**: The ad set is optimized for REACH, not clicks
   or conversions. This maximizes impressions but doesn't incentivize
   Meta's algorithm to find clickers or converters.

---

## GA4 Website Analytics (Last 30 Days)

### Site overview

| Metric | Value |
|---|---|
| Sessions | 80 |
| Users | 58 (59 new) |
| Engaged Sessions | 28 |
| Avg Session Duration | 126s |
| Bounce Rate | 65.0% |
| Pageviews | 127 |
| Conversions | 0 |

### Traffic sources

| Source / Medium | Sessions | Engaged | Bounce |
|---|---|---|---|
| (direct) / (none) | 40 | 8 | 80% |
| google / organic | 19 | 8 | 58% |
| facebook.com / referral | 9 | 8 | 11% |
| google / cpc | 2 | 1 | 50% |
| l.instagram.com / referral | 1 | 1 | 0% |
| Other sources | 9 | 2 | — |

### Key events

| Event | Count | Users |
|---|---|---|
| booking_modal_open | 2 | 2 |
| booking_confirm_pay_click | 1 | 1 |

No completed form submissions or bookings in the last 30 days.

### Ad-attributed traffic

- **Google Ads (CPC)**: 2 sessions, 0 conversions
- **Social (Instagram/Facebook referral)**: 10 sessions combined, 0
  conversions — but notably low bounce rates (11% from Facebook, 0% from
  Instagram)

### Top landing pages

| Page | Sessions | Bounce |
|---|---|---|
| /en (homepage) | 27 | 59% |
| / (root redirect) | 15 | 60% |
| /easter-2026-montessori-play-coaching-workshop | 6 | 67% |
| /easter | 3 | 0% |
| /my-best-auntie-training-course | 3 | 67% |
| /en/services/my-best-auntie-training-course | 2 | 100% |
| /links | 2 | 0% |

---

## Assessment and Recommendations

### Google Ads

**Status**: Not yet delivering. The campaign has been enabled for 3 days but
has generated zero impressions.

**Immediate actions needed**:
1. **Verify ad approval status**: Check in the Google Ads UI whether the
   responsive search ads have been approved. New ads need policy review
   (typically 1-3 business days).
2. **Check billing**: Confirm the billing method is active and the account has
   no payment issues.
3. **Monitor for 1 more week**: If still zero impressions by March 26, the
   keywords may have insufficient search volume in Hong Kong. Consider
   adding broader-but-still-relevant keywords.
4. **Add exact-match keywords**: The documented campaign plan includes exact
   match versions of the top 3 keywords ("domestic helper training course
   hong kong", "helper childcare training hong kong", "montessori helper
   training") — verify these are present in the live account (the API only
   showed phrase-match keywords for the active campaign).

**Structural assessment**: The campaign setup is solid — targeted keywords,
proper negative keywords, two responsive search ads with varied headlines,
sitelinks, and conversion tracking linked to GA4. The infrastructure is
ready; it just needs ad serving to begin.

### Meta Ads

**Status**: Active but underperforming on engagement metrics.

**Observations**:
1. **HK$134 spent for 5 post engagements** (HK$26.80 per engagement) is
   expensive. Industry benchmarks for Instagram engagement in Hong Kong are
   typically HK$2-8 per engagement.
2. **The ad is optimized for Reach, not engagement** — Meta is maximizing
   eyeballs, not interactions. This explains the high reach but low
   engagement rate.
3. **Targeting is well-aligned**: Women 30-45 in Hong Kong interested in
   parenting and Montessori education is a strong audience definition for
   this business.
4. **The campaign ends March 24** — only 5 days remaining.

**Recommendations**:
1. **Switch optimization goal**: If the goal is engagement, change the ad set
   optimization from REACH to POST_ENGAGEMENT. If the goal is website
   traffic, use LINK_CLICKS optimization instead.
2. **Test different creatives**: With only 1 ad running, there's no A/B
   testing. Consider boosting 2-3 different organic posts to identify which
   content resonates best.
3. **Consider a traffic campaign**: A separate campaign with OUTCOME_TRAFFIC
   objective would drive more visitors to the website, where conversion
   tracking is set up.
4. **Monitor the remaining 5 days**: The CTR improved from 0.045% on day 1
   to 0.166% on day 3, which is a positive trend worth watching.

### Cross-platform

1. **Low overall traffic**: 80 sessions/month is very low. Both ad platforms
   should focus on driving website traffic, not just awareness/engagement.
2. **Facebook referral is high quality**: 9 sessions with only 11% bounce
   rate suggests Facebook/Instagram traffic is highly engaged. This supports
   investing more in Meta traffic campaigns.
3. **No conversions yet**: With 80 sessions and 0 conversions, the sample
   size is too small to draw conclusions about conversion rate. Priority
   should be increasing traffic volume.
4. **Google organic is growing**: 19 sessions from organic search (24% of
   traffic) indicates SEO efforts are starting to pay off.

---

## Data Integrity Notes

- Google Ads API data was queried via service account through the MCC
  (manager account 544-581-2170) to the client account (499-114-4901).
- Meta Ads API data was queried via system user access token for ad account
  act_1562589928493715.
- GA4 data was queried via service account for property 525520074.
- All queries were read-only. No changes were made to any platform.
- Financial values are in HKD. Meta API returns spend in currency units;
  Google Ads API returns cost in micros (divided by 1,000,000).
