# Meta Ads Manual Setup Steps

UI-only tasks that can't be done through the read-only assessment scripts.
Grounded in the 2026-04-17 performance snapshot:

- Account: **Evolve Sprouts** (`act_1562589928493715`).
- `account_status = 9` = **IN_GRACE_PERIOD** (billing grace window;
  confirmed after updating `meta-ads-assessment.py` with the extended
  status map).
- Balance: HK$30.28.
- Easter Traffic campaign ended Apr 5 (still flagged ACTIVE at object
  level). Instagram Boost ended Mar 24 (still ACTIVE).
- **Free Guide Downloads — Lead Capture** created Apr 11, never
  delivered, paused.

Pre-requisite: sign into Meta Business Manager as an admin of
`Evolve Sprouts` business account, Ads Manager admin on the ad account.

---

## 1. Clear the IN_GRACE_PERIOD state (must happen first)

**Why**: delivery is disabled until billing is current. HK$30 balance
+ grace period means any un-paused campaign today will not spend.

1. **Meta Business Manager → Business Settings → Ad Accounts →
   Evolve Sprouts → Payment Settings**.
2. Check for any outstanding invoice at the top of **Billing** in
   Ads Manager. Settle it.
3. **Add a backup payment method** (second card). This is what
   typically lifts the grace-period flag.
4. **Business Settings → Security Center**. If **Business
   Verification** shows *Needs attention*, click **Start
   verification** and submit the HK BR (Business Registration) +
   Evolve Sprouts incorporation documents.
5. Go back to **Ads Manager** and re-run
   `python3 scripts/meta-ads-assessment.py`. Confirm
   `account_status = 1 (ACTIVE)` before moving on.

**Do not un-pause any campaign until account_status = 1.**

---

## 2. Archive the two "ACTIVE but ended" campaigns

**Why**: cleaner reporting. Our extended assessment script now flags
these explicitly.

1. **Ads Manager → Campaigns**. Filter: *Delivery = Not delivering*.
2. `Easter Workshop — Traffic — HK` → **... → Archive**.
3. `Instagram Boost — Organic Top Performers` → **... → Archive**.

---

## 3. Map GA4 events to Pixel standard events

**Why**: today Pixel only fires `PageView`, `Lead`, `Schedule`,
`InitiateCheckout`, `Contact`, `ViewContent`. Purchase is missing,
which means Meta has no revenue signal to optimise against — the
reason the Easter campaign was stuck on `link_click` bidding.

The code-side change landed in this PR: the Pixel now fires
`Purchase`, `AddPaymentInfo`, and `CompleteRegistration` from the
booking and community-signup flows. The Meta-side setup to confirm:

1. **Events Manager → Data Sources → pick the Pixel**. Open the
   **Overview** tab — confirm `Purchase`, `AddPaymentInfo`,
   `CompleteRegistration` appear in the **Received events** chart
   within 24 h of this PR deploying.
2. **Test Events** tab → open an Incognito window, book a test
   reservation with the smallest discount applied. Confirm the
   three new events arrive with:
   - `Purchase` — `currency=HKD`, non-empty `value`.
   - `AddPaymentInfo` — `currency=HKD`, non-empty `value`.
   - `CompleteRegistration` — fires on community signup.
3. **Settings → Match Quality**. Advanced Matching should be
   **Automatic advanced matching: On** with email and phone accepted
   (the booking form already collects both — no code change).
4. **Custom Conversions** — create one custom conversion called
   `Booking Purchase ≥ HK$300` filtered by `Purchase` + `value ≥
   300`. Used as the optimisation event for the next paid flight.

---

## 4. (Next iteration) Wire the Conversions API server-side

**Why**: iOS 14.5+ ATT losses hit browser-pixel attribution by 20–
40%. Server-side CAPI reclaims it.

This is **deferred** — it is not in the PR. The static-export public
site can't host a server endpoint, so CAPI must land in a backend
Lambda (`backend/lambda/**`). Open issue recommended:

- New Lambda `meta-conversions-api-relay` triggered off the same
  reservation success path that emails the customer.
- Use `EVOLVESPROUTS_META_SYSTEM_USER_ACCESS_TOKEN` (already in
  Cursor secrets) to authenticate.
- Send matching `event_id` values from both browser and server to
  enable deduplication.

---

## 5. Build the audience layer

### Custom audiences (Ads Manager → Audiences → Create audience →
Custom audience)

| Name | Source | Retention | Filter |
|---|---|---|---|
| All Website Visitors 180d | Website → Pixel | 180 days | All |
| Course Page Visitors 90d | Website → Pixel | 90 days | URL contains `my-best-auntie-training-course` |
| Easter Reel Viewers ≥50% 180d | Video | 180 days | Easter Reel video, thresholdPercentComplete ≥ 50 |
| IC not Purchase 30d | Pixel events | 30 days | `InitiateCheckout` TRUE, `Purchase` FALSE |
| IG Account Engagers 365d | Instagram account | 365 days | All |
| FB Page Engagers 365d | Facebook page | 365 days | All |

### Lookalike audiences (Audiences → Create audience → Lookalike)

| Name | Seed | Country | Size |
|---|---|---|---|
| LAL 1% HK — Purchase+IC | `IC not Purchase 30d` + `Purchase 180d` combined | HK | 1% |
| LAL 1–3% HK — Engagement | `All Website Visitors 180d` filtered to engagedTime > 30s (via custom) | HK | 1%, 2%, 3% (create all three) |
| LAL 1% HK — IG Engagers | `IG Account Engagers 365d` | HK | 1% |

---

## 6. Relaunch the paused `Free Guide Downloads — Lead Capture` campaign

**Why**: campaign created Apr 11, never delivered. The Easter formula
(Reel → LPV → HK women 25-45) proved 4.3x ROAS; we should reuse it for
the free-guide lead capture.

**Only un-pause once item 1 shows account_status = 1 (ACTIVE).**

1. **Ads Manager → Campaigns →** `Free Guide Downloads — Lead
   Capture`.
2. Edit campaign → **Objective → change to `Leads`** (from `Traffic`).
3. Ad set (`Free Guide — HK Women 25-50`):
   - **Conversion location** → **Instant Forms**.
   - **Performance Goal** → **Maximize number of leads**.
   - **Budget**: HK$50/day (unchanged).
   - **Schedule**: 7-day flight.
   - **Targeting**: keep HK women 25-50; duplicate the ad set with
     `LAL 1% HK — Engagement` audience layered on top as a parallel
     test.
4. Create two ads (A/B under Advantage+ Creative):
   - **A**: Short vertical Reel (15–30 s) with the guide cover.
   - **B**: Static carousel of 3–4 guide pages.
5. **Instant Form**:
   - Pre-fill: email, first name, phone.
   - Completion screen: "Thanks! Check your email. And tap below
     to chat with us on WhatsApp." with a WhatsApp link.
6. Tag the landing URL with UTMs per `README.md` convention, e.g.
   `?utm_source=meta&utm_medium=paid_social&utm_campaign=free-guide-apr-2026&utm_content=reel-v1`.
7. **Mailchimp automation**: in the Mailchimp account, create a
   "Free Guide Welcome" journey triggered by the form's audience
   (Cursor secret: `EVOLVESPROUTS_MAILCHIMP_AUDIENCE_ID`). Emails 1,
   3, 7 days after submission.

---

## 7. Next-cohort paid Reel flight (once Pixel Purchase is recording)

**Why**: Easter recipe produced HK$1,400 from HK$322. Repeat pattern.

1. Duplicate the Easter Traffic ad, change:
   - Objective: **Sales** (not Traffic).
   - Optimisation: **Purchase** (needs at least a handful of purchase
     events first — fall back to **InitiateCheckout** and use a
     **conversion value rule** crediting HK$350 if Purchase data is
     too thin).
2. Ad set budget: HK$50/day × 7 days.
3. Targeting: HK women 25-45 + `LAL 1% HK — Purchase+IC`.
4. Creative: a new Reel for the next cohort opening. Hook first 2s,
   value 2-18s, CTA 18-25s, end card with WhatsApp + course page.
5. Creative rotation rule: rotate any ad whose 7-day CTR drops below
   **0.8%** or whose frequency exceeds **2.5**.

---

## 8. Evergreen brand ad set (always on)

**Why**: Pixel cold-starts every time we turn a campaign back on, and
each cold start costs 7–14 days of re-learning. An always-on HK$20/day
warms it continuously.

1. **Ads Manager → Create → Engagement → Post Engagement**.
2. Campaign name: `Evergreen Brand — HK Women 25-45`.
3. Daily budget: **HK$20**.
4. Targeting: HK women 25-45 **exclude** `All Website Visitors 180d`
   (so we only spend on people who haven't seen us).
5. Creative: one carousel of our 3 highest-performing organic IG posts.
6. Enable **Advantage+ placements**.

---

## 9. Standing creative rotation policy

- Every paid flight reviews creative performance at day 3 and day 7.
- Rotate any ad with CTR < 0.8% for 3 consecutive days.
- Rotate any ad with Frequency > 2.5.
- Keep a rolling backlog of 2–3 creatives per flight so rotations
  don't starve learning-phase.

---

## 10. Monthly verification checklist

- [ ] Run `python3 scripts/meta-ads-assessment.py` — confirm
      `account_status = 1 (ACTIVE)`.
- [ ] Open **Events Manager → Pixel → Overview** — confirm all six
      standard events (`PageView`, `Lead`, `InitiateCheckout`,
      `AddPaymentInfo`, `Purchase`, `CompleteRegistration`) with
      deduplication rate > 90% once CAPI lands.
- [ ] Open **Audiences** — every custom audience should show
      "Populated" with size > 1,000 (LAL requirements).
- [ ] Open **Campaigns** — no "ACTIVE but ended" campaigns should
      remain (the extended assessment script now prints an explicit
      warning for these).
