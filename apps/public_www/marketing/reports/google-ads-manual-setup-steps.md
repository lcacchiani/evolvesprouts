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

## 1. Turn on Enhanced Conversions for Web

**Why**: 136 paid clicks, 0 Google-attributed conversions. The booking
form collects email; enhanced conversions hash-match that email back to
Google users and typically recover 10–30% of otherwise-lost attribution.

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

**Why**: Today bidding only has 2 `booking_submit_success` in the last
30 days. More signal = better bidding. Secondary means it does not
count towards the campaign's reported conversions, so ROAS stays clean.

1. **Goals → Summary → + New conversion action → Import → Google
   Analytics 4 properties → Web**.
2. Pick the linked GA4 property `Evolve Sprouts Website (525520074)`.
3. Tick these events (one by one creates them with sensible defaults):
   - `whatsapp_click`
   - `contact_form_submit_success`
   - `media_form_submit_success`
   - `community_signup_submit_success`
   - `booking_confirm_pay_click` (mid-funnel; rich in signal once made a
     GA4 key event — see `ga4-manual-setup-steps.md` §3).
4. Click **Import and continue**.
5. For each newly-imported action, open it and set **Conversion action
   optimisation** = **Secondary**. This keeps the ROAS column honest.

---

## 3. Weekly search-terms review

**Why**: the 2026-04-17 pull already shows `"helperchoice"` (a
competitor site) eating 8 clicks for HK$64. A 5-minute weekly habit
prevents slow budget bleed.

1. **Campaigns → My Best Auntie — Search — HK → Insights and reports →
   Search terms**. Set the range to **Last 7 days**.
2. Sort by **Clicks ↓**.
3. For each search term that is clearly off-topic (competitors, UK/US
   locations, job-seeker intent, "salary", "apply", "vacancy",
   "philippines", "indonesia", etc.): tick the checkbox → **Add as
   negative keyword** → scope = **Campaign** → match type =
   **Exact** for competitor brands, **Phrase** for topic bleed.
4. Save. Copy the list of negatives you added into the upcoming Monday
   assessment report.

**Seed negatives to add today** (based on the Apr 17 search-terms pull):

| Term | Match type | Reason |
|---|---|---|
| `helperchoice` | Exact | Competitor brand |
| `helperplace` | Exact | Competitor brand |
| `helper jobs` | Phrase | Job-seeker intent |
| `helper salary` | Phrase | Job-seeker intent |
| `helper visa` | Phrase | Job-seeker intent |
| `helper agency` | Phrase | Agency shopper (not our ICP) |
| `philippines` | Phrase | Country bleed |
| `indonesia` | Phrase | Country bleed |
| `apply helper` | Phrase | Job-seeker intent |

---

## 4. Split the dormant broad keywords into a `Discovery — Broad` ad group

**Why**: 4 of 30 broad keywords are delivering; the other 26
(`child development`, `child care`, `montessori childcare`,
`childcare level 3 course`, etc.) are being starved because they
share an ad group and bid strategy with winners that have higher
expected CPCs.

1. **Campaigns → My Best Auntie — Search — HK → Ad groups → + New ad
   group**.
2. Name: `Discovery — Broad`.
3. Ad rotation: **Optimise**.
4. CPC ceiling: **HK$5** (set under *Settings → Bidding → Advanced →
   Maximum CPC bid limit*). The existing Helper Training group
   averages HK$9.73 CPC; the ceiling here is intentionally lower.
5. Add the 26 currently-zero-impression keywords from
   `reports/ads-performance-assessment-2026-04-17.md` (Keyword
   performance table). Keep broad match.
6. Attach one responsive search ad (copy from `Helper Training Course`
   ad group; final URL →
   `/en/services/my-best-auntie-training-course/?utm_source=google&utm_medium=cpc&utm_campaign=my-best-auntie-search-hk&utm_content=discovery-broad`).
7. Pause the same 26 keywords inside the original Helper Training Course
   ad group so they don't compete.

## 5. Add phrase-match variants for the three winners

**Why**: today every click is routed through broad match. Phrase
matches typically cost 15–25% less for the same intent.

1. In ad group **Helper Training Course**, **Keywords → + New
   keywords**, add:
   - `"helper training hong kong"` (phrase)
   - `"childcare helper training"` (phrase)
   - `"domestic helper course hong kong"` (phrase)
2. Leave the broad versions enabled — Google will pick the best match.

---

## 6. Rescue the Family Consultations click-to-conversion gap

**Why**: HK$100 spent, 15 clicks, 0 conversions on
`/en/services/consultations` (76% bounce in GA4).

1. In the Family Consultations ad, edit **Final URL** to:
   ```
   https://www.evolvesprouts.com/en/services/consultations/?utm_source=google&utm_medium=cpc&utm_campaign=my-best-auntie-search-hk&utm_content=family-consultations
   ```
2. Wait for the ga4-manual-setup-steps item that registers a
   consultation-scoped conversion (`whatsapp_click` filtered by page),
   then import it as a **Secondary** conversion for this campaign.

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
