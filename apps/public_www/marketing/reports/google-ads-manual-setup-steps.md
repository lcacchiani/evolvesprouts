# Google Ads Manual Setup Steps

UI-only tasks that can't be done through the read-only assessment scripts.
Grounded in the 2026-04-17 performance snapshot:

- Account: `My Best Auntie — Search — HK` (CID `499-114-4901`, MCC
  `544-581-2170`).
- All-time: 2,516 imp, 136 clicks, HK$1,277 spend, **0 Google-attributed
  conversions**.
- 26 of 30 broad-match keywords dormant; `"helperchoice"` appearing in
  search terms (likely waste to negative).
- New Family Consultations ad group: HK$6.68 CPC on "montessori
  consultation" going to `/en/services/consultations` — 0 GA4 conversions
  on the destination page.

Execute one item per week on the Tue slot of the cadence defined in
`apps/public_www/marketing/README.md`.

Pre-requisite for every item: sign into Google Ads as an admin of
`My Best Auntie — Search — HK`.

---

## 1. Turn on Enhanced Conversions for Web (UI-only)

**Why**: 136 paid clicks, 0 Google-attributed conversions. The booking
form collects email; enhanced conversions hash-match that email back to
Google users and typically recover 10–30% of otherwise-lost attribution.

**Note**: Enhanced Conversions has **no Google Ads API surface** — the
toggle must be flipped in the Google Ads UI by an admin. Everything
else in this doc has been automated.

1. **Goals → Conversions → Summary**.
2. Open **GA4 - Booking Submit Success**.
3. Scroll to **Enhanced conversions**. Toggle **Turn on enhanced
   conversions**.
4. Select **Google tag** as the implementation method (we use GTM via
   GA4, not direct gtag).
5. Accept the customer data terms.
6. Repeat for **GA4 - Contact Form Submit Success**.
7. Wait 48–72 h and re-check **Diagnostics** for each action — status
   should progress to *Recording*.

---

## 2. Import additional GA4 events as secondary conversions

**Status: DONE via API on 2026-04-17** (see
`scripts/apply/google-ads-enable-secondary-conversions.py`).

The account now has these Secondary conversion actions enabled (not
counted in ROAS; training signal only):

- `Evolve Sprouts Website (web) booking_confirm_pay_click`
- `Evolve Sprouts Website (web) whatsapp_click`
- `Evolve Sprouts Website (web) media_form_submit_success`
- `Evolve Sprouts Website (web) community_signup_submit_success`

`GA4 - Contact Form Submit Success` was already enabled. The primary
goal remains `GA4 - Booking Submit Success`.

To add future key events in one step:

1. `python3 scripts/apply/ga4-mark-key-events.py --apply` (marks in GA4).
2. Wait for the auto-sync to create the `(web) <event_name>` action in
   Google Ads (typically seconds; occasionally up to 24 h).
3. Add the new name to `TARGET_NAMES` in
   `scripts/apply/google-ads-enable-secondary-conversions.py` and run
   `--apply`.

---

## 3. Weekly search-terms review

**Status: initial seed batch applied 2026-04-17 via API** — 29
campaign-level negatives added (see
`scripts/apply/google-ads-apply-tuesday-changes.py --steps negatives`).
Live account already had 10 broad-match negatives
(`free`, `job`, `visa`, `immigration`, `cleaning`, `placement`,
`agency`, `salary`, `maid`, `"FDH employment"`) before the script ran,
so the total campaign-level negative list is now 39.

The script is idempotent. To add more, edit the `CAMPAIGN_NEGATIVES`
list in the file and re-run:

```bash
python3 scripts/apply/google-ads-apply-tuesday-changes.py --dry-run --steps negatives
python3 scripts/apply/google-ads-apply-tuesday-changes.py --apply   --steps negatives
```

Weekly cadence check (UI):

1. **Campaigns → My Best Auntie — Search — HK → Insights and reports →
   Search terms**. Set the range to **Last 7 days**.
2. Sort by **Clicks ↓**.
3. For any new off-topic clusters, add entries to `CAMPAIGN_NEGATIVES`
   in the apply script (so the list stays version-controlled) and run
   `--apply --steps negatives`.

---

## 4. (Withdrawn) Discovery — Broad ad group

This step was in the original plan based on a narrative assumption that
the ad group contained 26 zero-impression keywords. A live API probe on
2026-04-17 showed the Helper Training Course ad group actually has 19
keywords (mix of broad/phrase/exact) and the Family Consultations ad
group has 6. The restructuring this step targeted is not the real
problem. Skipped.

## 5. Add phrase-match variants for the three winners

**Status: DONE via API on 2026-04-17** (see
`scripts/apply/google-ads-apply-tuesday-changes.py --steps phrase`).

Added to the Helper Training Course ad group:

- `"helper training hong kong"` (phrase)
- `"childcare helper training"` (phrase)
- `"domestic helper course hong kong"` (phrase)

The broad versions remain enabled — Google will pick the best match
per query.

---

## 6. Rescue the Family Consultations click-to-conversion gap

**Status: UTM tagging DONE via API on 2026-04-17** (see
`scripts/apply/google-ads-apply-tuesday-changes.py --steps utm`).

All three enabled ads in the campaign now have final URLs tagged with
`utm_source=google&utm_medium=cpc&utm_campaign=my-best-auntie-search-hk&utm_content=<slug>`.
The script is idempotent — re-runs leave already-tagged URLs alone.

Still valuable but not automated:

- Track CTR / bounce-rate / GA4 conversions for the Family
  Consultations ad weekly; consider building a consultation-scoped
  event (e.g. `consultation_whatsapp_click`) if 15+ more clicks go
  through with 0 conversions.

---

## 7. Link GA4 audiences + launch Display remarketing

**Why**: 2,516 impressions reached HK parents; zero remarketing layer
exists today.

1. Run `python3 scripts/ga4-create-audiences.py` following the
   documented temporary-Editor flow (see
   `apps/public_www/marketing/README.md` and
   `ga4-manual-setup-steps.md`).
2. In Google Ads: **Tools → Shared library → Audience manager → Your
   data sources → Google Analytics (GA4)**. Ensure **Status** is
   *Linked*. If not, click **Link**.
3. Wait ~24 h for the three audiences to appear under **Audiences →
   Website visitors**.
4. **+ New campaign → Create a campaign without a goal's guidance →
   Display → Standard display**.
5. Budget: **HK$30/day**, location: **Hong Kong**.
6. Targeting: add these audiences as **Targeting**:
   - Course Page Visitors
   - Booking Intent — Did Not Complete
7. Frequency cap: **3 impressions / day / user**.
8. Creative: reuse the Easter Reel as a 1:1 MP4; add 1 static hero
   image pulled from the course page.
9. Also add **Course Page Visitors** as an **Observation** (+25% bid
   adjustment) on the existing `My Best Auntie — Search — HK`
   campaign.

---

## 8. (Gated) Launch a Performance Max campaign — only once items 1–3 are live

**Why**: PMax without multiple conversion signals will waste budget.

1. Wait until Enhanced Conversions (item 1) is recording and at least
   two secondary conversions (item 2) are importing.
2. **+ New campaign → Sales or Leads → Performance Max**.
3. Budget: **HK$50/day**.
4. Conversion goal: `GA4 - Booking Submit Success` (primary) plus the
   three secondary conversions from item 2.
5. Asset group: course-page images + Easter Reel MP4 + headlines from
   the existing responsive search ads.
6. Final URL expansion: **On** with `evolvesprouts.com/*` URL rule.
7. Audience signal: Course Page Visitors + demographics HK women 25-45.
8. Review spend + CPA **every 48 h for the first 14 days**. Kill if
   CPA > HK$200 or if search-term data (where available) shows it
   cannibalising the Search campaign.

---

## 9. Standing checklist (every new ad)

- Final URL includes `?utm_source=google&utm_medium=cpc&utm_campaign=...&utm_content=...`.
- Ad URL options → **Tracking template**: leave blank (we rely on
  gclid auto-tagging plus UTMs).
- At least 1 responsive search ad per ad group.
- All text assets pinned only when strictly necessary — unpinned text
  yields higher ad strength.
