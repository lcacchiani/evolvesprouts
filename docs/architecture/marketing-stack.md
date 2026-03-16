# Marketing & Analytics Stack

This document describes the marketing, analytics, and advertising tools used
by Evolve Sprouts, how they relate to the codebase, and the operational
processes around them.

## Stack overview

```
                    ┌───────────────────────────────────────────┐
                    │            www.evolvesprouts.com           │
                    │         (Next.js static export)           │
                    │          apps/public_www/                  │
                    └──────────────┬────────────────────────────┘
                                   │
                         init-gtm.js loads GTM
                                   │
                    ┌──────────────▼────────────────────────────┐
                    │      Google Tag Manager (GTM)              │
                    │      Container: GTM-NJ2LB39H              │
                    │      Account: 6340608406                   │
                    └──────┬───────────────────┬────────────────┘
                           │                   │
              Google Tag   │                   │   Google Tag
              G-YJTWSCB01P │                   │   AW-18019068393
                           │                   │
                    ┌──────▼──────┐     ┌──────▼──────┐
                    │    GA4      │     │ Google Ads   │
                    │  Property   │────▶│  Account     │
                    │  525520074  │     │ 499-114-4901 │
                    └──────┬──────┘     └──────────────┘
                           │
              ┌────────────┼────────────┐
              │            │            │
     ┌────────▼──┐  ┌──────▼──┐  ┌──────▼──────┐
     │  Search   │  │ Custom  │  │   Key       │
     │  Console  │  │ Dims    │  │   Events    │
     │  (linked) │  │ (12)    │  │   (7)       │
     └───────────┘  └─────────┘  └─────────────┘
```

## Google Cloud Platform (GCP)

### Service account

- **Email**: `ga4-reader@evolve-sprouts.iam.gserviceaccount.com`
- **Project**: `evolve-sprouts`
- **Credential storage**: Cursor Cloud Agent secret
  `EVOLVESPROUTS_GOOGLE_SERVICE_ACCOUNT_JSON`
- **Default permissions**: Read-only across all services. Write access is
  elevated on an ad hoc basis when configuration changes are needed, then
  revoked back to read-only.

### What the service account can access

| Service | Default access | Elevated access (ad hoc) |
|---|---|---|
| GA4 Admin API | Reader | Editor — create/update custom dimensions, key events, data retention |
| GA4 Data API | Reader | (same) — query reports, pull session/event/user data |
| GTM API | Read | Admin + Publish — create/update/delete tags, triggers, variables; publish versions |
| Google Ads API | Explorer (read) | Standard — create/modify campaigns, keywords, ads, conversions |

To elevate access for a configuration session, grant the service account
the required role in the relevant tool's admin panel, then revoke after
changes are complete.

## Google Tag Manager (GTM)

### Container details

| Field | Value |
|---|---|
| Account ID | `6340608406` |
| Container ID | `244310102` |
| Public ID | `GTM-NJ2LB39H` |
| Container name | `www.evolvesprouts.com` |

### How GTM loads on the website

1. Root layout (`apps/public_www/src/app/layout.tsx`) sets `data-gtm-id` and
   `data-gtm-allowed-hosts` on the `<html>` element when `NEXT_PUBLIC_GTM_ID`
   is configured.
2. `GoogleTagManager` component (`src/components/shared/google-tag-manager.tsx`)
   renders a `<script>` tag pointing to `public/scripts/init-gtm.js`.
3. `init-gtm.js` reads `data-gtm-id` and `data-gtm-allowed-hosts` from the
   document, verifies the current host is allowed, and loads
   `googletagmanager.com/gtm.js`.
4. CSP injection (`scripts/inject-csp-meta.mjs`) automatically adds GTM and
   GA4 origins to `script-src` and `connect-src` when GTM is detected in the
   built HTML.

### Environment variables

| Variable | Purpose |
|---|---|
| `NEXT_PUBLIC_GTM_ID` | GTM container ID (`GTM-NJ2LB39H`). If unset, GTM does not load. |
| `NEXT_PUBLIC_GTM_ALLOWED_HOSTS` | Comma-separated hostnames where GTM is allowed to fire. Falls back to `NEXT_PUBLIC_SITE_ORIGIN` hostname. |

### Live container contents (version 9)

| Component | Count | Details |
|---|---|---|
| Google Tags | 2 | `GA4 - Configuration` (G-YJTWSCB01P), `Google Ads - Conversion Tracking` (AW-18019068393) |
| GA4 Event Tags | 20 | One per custom event in the analytics taxonomy |
| Custom Event Triggers | 20 | One per custom event |
| Data Layer Variables | 14 | All event parameters from the taxonomy |
| Consent Default | 1 | Custom HTML tag setting default consent state |

### Event tracking in the codebase

All custom events are fired through a single function:

```
trackAnalyticsEvent(eventName, { sectionId, ctaLocation, params })
```

- **Source**: `apps/public_www/src/lib/analytics.ts`
- **Taxonomy contract**: `apps/public_www/src/lib/analytics-taxonomy.json`
- **Validation**: `npm run validate:analytics-contract` (enforced in lint)
- **Governance**: `npm run validate:analytics-governance` (enforced in PRs)

The function pushes typed payloads to `window.dataLayer`. GTM picks these up
via custom event triggers and forwards them to GA4 through the event tags.

Components that fire events:

| Component | Events |
|---|---|
| `whatsapp-contact-button.tsx` | `whatsapp_click` |
| `contact-us-form.tsx` | `contact_form_submit_attempt`, `_success`, `_error` |
| `media-form.tsx` | `media_form_open`, `_submit_success`, `_submit_error` |
| `sprouts-squad-community.tsx` | `community_signup_submit_success`, `_error` |
| `event-notification.tsx` | `community_signup_submit_success`, `_error` |
| `my-best-auntie-booking.tsx` | `booking_modal_open`, `booking_age_selected`, `booking_date_selected`, `booking_confirm_pay_click` |
| `reservation-form.tsx` | `booking_payment_method_selected`, `booking_discount_apply_*`, `booking_submit_*` |
| `thank-you-modal.tsx` | `booking_thank_you_view`, `booking_receipt_print_click` |

## Google Analytics 4 (GA4)

### Property details

| Field | Value |
|---|---|
| Account | Evolve Sprouts (`329053801`) |
| Property | Evolve Sprouts Website (`525520074`) |
| Data stream | Evolve Sprouts Production |
| Measurement ID | `G-YJTWSCB01P` |
| Default URI | `https://www.evolvesprouts.com/` |

### Configuration

| Setting | Value |
|---|---|
| Data retention | 14 months |
| Reset user data on new activity | Yes |
| Google Signals | Enabled |
| Enhanced measurement | All features ON (scrolls, outbound clicks, site search, video, file downloads, page changes, form interactions) |

### Custom dimensions (12 event-scoped)

`page_locale`, `cta_location`, `section_id`, `discount_type`,
`payment_method`, `form_type`, `cohort_date`, `error_type`, `environment`,
`resource_key`, `age_group`, `cohort_label`

### Key events (7)

| Event | Source |
|---|---|
| `booking_submit_success` | Custom (from taxonomy) |
| `contact_form_submit_success` | Custom (from taxonomy) |
| `media_form_submit_success` | Custom (from taxonomy) |
| `community_signup_submit_success` | Custom (from taxonomy) |
| `purchase` | Auto-created by Google |
| `close_convert_lead` | Auto-created by Google |
| `qualify_lead` | Auto-created by Google |

### Linked products

| Product | Account/Property |
|---|---|
| Google Ads | `499-114-4901` (Evolve Sprouts) |
| Google Search Console | `https://www.evolvesprouts.com` (URL-prefix property) |

## Google Ads

### Account details

| Field | Value |
|---|---|
| Account ID | `499-114-4901` |
| Account name | Evolve Sprouts |
| Currency | HKD |
| Timezone | Asia/Hong_Kong |
| Billing | Business payment method (approved) |
| Auto-tagging | Enabled |

### Campaign: My Best Auntie — Search — HK

| Setting | Value |
|---|---|
| Type | Search |
| Status | Paused (enable when ready) |
| Budget | HK$50/day |
| Bidding | Manual CPC (HK$20 default bid) |
| Networks | Google Search only (no partners, no display) |
| Location | Hong Kong (presence only) |
| Language | English |

#### Keywords (11)

**Phrase match (8):**
`domestic helper training course hong kong`,
`helper childcare training hong kong`,
`helper training course hk`,
`auntie training course hong kong`,
`montessori helper training hong kong`,
`domestic helper childcare course`,
`train my helper hong kong`,
`helper parenting course hong kong`

**Exact match (3):**
`domestic helper training course hong kong`,
`helper childcare training hong kong`,
`montessori helper training`

#### Negative keywords (10, broad match)

`free`, `job`, `salary`, `agency`, `placement`, `maid`, `cleaning`, `visa`,
`immigration`, `FDH employment`

#### Ads (2 responsive search ads)

Both point to
`https://www.evolvesprouts.com/en/services/my-best-auntie-training-course/`
with 15 headlines and 4 descriptions each, covering brand name, course
features, pricing, and trust signals.

#### Sitelinks (3)

About the Founder, Upcoming Events, Contact Us

#### Conversion actions

| Action | Type | Role |
|---|---|---|
| GA4 - Booking Submit Success | Primary | Drives bidding optimization |
| GA4 - Contact Form Submit Success | Secondary | Observation only |

### Inactive accounts (pending cancellation)

| Account | ID | Type | Status |
|---|---|---|---|
| Evolve Sprouts (Manager) | `544-581-2170` | MCC | Empty, no billing, no sub-accounts. Safe to cancel. |
| Evolve Sprouts (old) | `628-648-5411` | Standard | Old account with individual billing. Campaign moved to `499-114-4901`. Safe to cancel. |

## Google Search Console

### Property

- **Type**: URL-prefix
- **URL**: `https://www.evolvesprouts.com`
- **Linked to GA4**: Yes

### Sitemap

- **URL**: `https://www.evolvesprouts.com/sitemap.xml`
- **Generated by**: `apps/public_www/src/app/sitemap.ts`
- **Entries**: 21 (7 routes x 3 locales: en, zh-CN, zh-HK)
- **Features**: Per-entry hreflang alternates with `x-default`

### Robots.txt

- **Generated by**: `apps/public_www/src/app/robots.ts`
- **Features**: Disallow rules for redirect-only routes, AI crawler
  allowlists for `/llms.txt` and `/llms-full.txt`

## Email (iCloud Mail with custom domain)

### Setup

| Field | Value |
|---|---|
| Provider | iCloud Mail (Apple iCloud+) |
| Custom domain | `evolvesprouts.com` |
| Primary address | `ida@evolvesprouts.com` |
| Contact address (website) | Configured via `NEXT_PUBLIC_EMAIL` env var |

### How email relates to the codebase

Email is used in two distinct ways:

#### 1. Outbound transactional email (AWS SES)

The backend uses **Amazon SES** (not iCloud) for all automated outbound
email — notifications to sales/support when forms are submitted, booking
confirmations, etc. This is configured in the Lambda environment:

| Variable | Purpose |
|---|---|
| `SES_SENDER_EMAIL` | Verified SES sender address for outbound notifications |
| `SUPPORT_EMAIL` | Recipient address for sales/support notifications |

SES is used because iCloud Mail does not provide an SMTP API for
programmatic sending. The SES sender domain must be verified in AWS.

#### 2. Business email (iCloud Mail)

The `ida@evolvesprouts.com` inbox is used for:
- Direct replies to leads and clients
- Receiving SES notification emails about new form submissions
- Google account owner email (GA4, GTM, Google Ads, Search Console)
- Domain verification for Google Search Console

iCloud Mail provides the inbox; SES provides the programmatic sending.

### Lead capture flow

All website leads are captured in the database before any email is sent.
The inbox notification is an alert, not the source of truth.

```
Lead sources:
  Contact form ──────▶ API ──▶ DB (contact + sales lead) ──▶ SES alert
  Media download ────▶ API ──▶ DB (contact + sales lead) ──▶ SES alert ──▶ Mailchimp
  Community signup ──▶ API ──▶ DB (contact + sales lead) ──▶ SES alert ──▶ Mailchimp
  Event notification ▶ API ──▶ DB (contact + sales lead) ──▶ SES alert ──▶ Mailchimp
  Booking ───────────▶ API ──▶ DB (contact + reservation) ─▶ SES alert

  WhatsApp DMs ──────▶ Manual entry (or future WhatsApp Business API)
  LinkedIn DMs ──────▶ Manual entry (redirect to trackable channel)
  Direct email ──────▶ Manual (rare, handle case-by-case)
```

## Social media and lead generation

### Meta (Instagram + WhatsApp)

- **Instagram**: `@evolvesprouts` — primary social channel for brand
  awareness and engagement
- **WhatsApp Business**: Used for direct lead communication; linked from
  website CTAs via `NEXT_PUBLIC_WHATSAPP_URL`
- **Integration with website**: WhatsApp floating button and CTA links
  throughout the site use prefilled messages configured in locale content
  files. The `buildWhatsappPrefilledHref` function in
  `apps/public_www/src/lib/site-config.ts` handles URL construction.
- **Meta account details**: TBD (to be documented separately)

### LinkedIn

- **Company page**: [linkedin.com/company/evolve-sprouts](https://www.linkedin.com/company/evolve-sprouts)
- **Content strategy**: Instagram posts are automatically cross-posted to
  LinkedIn via Zapier
- **Lead capture**: LinkedIn DMs cannot be programmatically forwarded to a
  CRM. LinkedIn's API does not support reading or exporting DMs. The
  recommended workaround is documented below.

### Zapier

- **Current automation**: Instagram post → LinkedIn post (automatic
  cross-posting)
- **Account details**: TBD

## Mailchimp (email marketing)

### Account details

| Field | Value |
|---|---|
| Server prefix | `us-12` |
| Audience/List ID | `355b40c8b5` |

### How Mailchimp integrates with the codebase

Mailchimp is used for email list management, subscriber tagging, and
sending a monthly newsletter. Subscriber management is automated via
backend Lambda functions. The monthly newsletter is composed and sent
manually through the Mailchimp dashboard.

#### Data flow

```
Website form submit
        │
        ▼
  API Gateway (/v1/media-request or /v1/contact-us)
        │
        ▼
  Admin Lambda (backend/lambda/admin/handler.py)
        │
        ▼
  SNS topic → SQS queue
        │
        ▼
  Media Request Processor Lambda (backend/lambda/media_processor/handler.py)
        │
        ├─▶ Database: upsert contact, create sales lead
        ├─▶ Mailchimp: add/update subscriber + apply tag
        └─▶ SES: send notification to sales/support
```

#### Backend code

- **Mailchimp service**: `backend/src/app/services/mailchimp.py`
  - `add_subscriber_with_tag(email, first_name, tag_name)` — upserts a
    subscriber in the configured audience and applies a tag
  - Uses `http_invoke` (AWS proxy) to call the Mailchimp API from within
    VPC
  - API key stored in AWS Secrets Manager (`MAILCHIMP_API_SECRET_ARN`)
- **Media processor**: `backend/lambda/media_processor/handler.py`
  - Processes SQS messages from form submissions
  - Calls Mailchimp to sync subscribers after DB operations
- **Webhook handler**: `backend/src/app/api/public_mailchimp_webhook.py`
  - Receives Mailchimp webhook callbacks at `/v1/mailchimp/webhook`
  - Reconciles contact sync status in the database

#### Lambda environment variables

| Variable | Purpose |
|---|---|
| `MAILCHIMP_API_SECRET_ARN` | AWS Secrets Manager ARN for the Mailchimp API key |
| `MAILCHIMP_LIST_ID` | Mailchimp audience/list ID |
| `MAILCHIMP_SERVER_PREFIX` | Mailchimp data center (e.g., `us-12`) |

#### Cursor Cloud Agent secrets (for API access outside AWS)

| Secret | Purpose |
|---|---|
| `EVOLVESPROUTS_MAILCHIMP_API_KEY` | Direct API key for Mailchimp (used by Cloud Agents) |
| `EVOLVESPROUTS_MAILCHIMP_AUDIENCE_ID` | Audience ID (`355b40c8b5`) |
| `EVOLVESPROUTS_MAILCHIMP_SERVER_PREFIX` | Server prefix (`us-12`) |

### Subscriber lifecycle

1. User submits a form on the website (media download, community signup,
   event notification, or contact form).
2. The form submission hits the API Gateway, which triggers the admin Lambda.
3. The admin Lambda publishes to SNS, which delivers to the SQS queue.
4. The media processor Lambda picks up the message and:
   - Upserts the contact in the database
   - Creates a sales lead record
   - Calls `add_subscriber_with_tag` to add/update the subscriber in
     Mailchimp with a tag identifying the form source (e.g.,
     `patience-free-guide`, `community-signup`, `event-notification`)
   - Sends an email notification to sales/support via SES
5. Mailchimp webhook callbacks (`/v1/mailchimp/webhook`) reconcile
   subscription status changes (unsubscribe, bounce) back to the database.

### Monthly newsletter

- Composed and sent manually via the Mailchimp dashboard
- Sent to the full subscriber audience (`355b40c8b5`)
- Content typically includes: upcoming events, course updates, parenting
  tips, and community highlights
- Subscriber tags from automated sign-ups can be used to segment the
  audience for targeted campaigns if needed

## LinkedIn DM lead capture — limitations and workarounds

LinkedIn does not provide API access to direct messages for standard company
pages. The Messaging API is restricted to LinkedIn Recruiter and Sales
Navigator enterprise contracts. This means there is no programmatic way to
forward LinkedIn DMs to a sales CRM.

### Recommended workarounds

1. **Manual triage with a standard response template**: When a DM arrives on
   LinkedIn, respond with a short message directing the lead to a trackable
   channel:
   > "Thanks for reaching out! For the fastest response, please contact us
   > via our website (evolvesprouts.com/en/contact-us) or WhatsApp. We'll
   > get back to you within 24 hours."
   This routes leads into channels that ARE connected to the CRM (contact
   form → CRM API, WhatsApp → manual or Zapier-based CRM entry).

2. **LinkedIn Lead Gen Forms (paid)**: If running LinkedIn Ads in the future,
   Lead Gen Forms capture contact details (name, email, company) directly
   within LinkedIn. These CAN be connected to a CRM via Zapier or the
   LinkedIn Marketing API.

3. **LinkedIn Sales Navigator (enterprise)**: Provides CRM sync
   (Salesforce, HubSpot, Microsoft Dynamics) for InMail and messaging. Only
   viable at scale; not recommended for current business size.

4. **Zapier LinkedIn trigger**: Zapier offers a "New Company Update" trigger
   for LinkedIn but does NOT offer a DM/message trigger. This is a LinkedIn
   API limitation, not a Zapier limitation.

## Improvement opportunities

### Current setup assessment

| Channel | Status | Verdict |
|---|---|---|
| Website SEO | Recently optimized (keyword-aligned titles, meta descriptions, structured data, FAQ schema, hreflang) | Good foundation; needs time for organic ranking to build |
| GTM/GA4 | Fully configured with 22 custom events, 12 dimensions, 7 key events | Solid; monitor for data flow |
| Google Ads | Search campaign live with targeted keywords, proper conversions | Good; optimize after 2-4 weeks of data |
| Google Business Profile | Created and linked to GA4 | Post weekly to maintain activity |
| Instagram → LinkedIn | Automated via Zapier | Works but could be improved (see below) |
| LinkedIn DMs → CRM | No programmatic path | Use redirect-to-trackable-channel workaround |
| Mailchimp | Fully integrated (backend subscriber sync with tags, webhook reconciliation) | Build nurture sequences per tag |
| WhatsApp → CRM | Manual | Consider Zapier WhatsApp Business integration when volume grows |

### Potential improvements

1. **Instagram content differentiation for LinkedIn**: Auto-crossposting
   identical content works for consistency but LinkedIn audiences respond
   better to professional/educational framing vs Instagram's visual-first
   approach. Consider having Zapier transform the caption (e.g., add
   hashtags relevant to LinkedIn, remove Instagram-specific ones) or
   manually craft LinkedIn-specific posts for key content.

2. **UTM parameters on social links**: Add UTM parameters to all links
   shared on Instagram, LinkedIn, and WhatsApp to track which social channel
   drives the most website traffic and conversions in GA4. Format:
   `?utm_source=instagram&utm_medium=social&utm_campaign=organic`

3. **WhatsApp Business API**: When lead volume grows, consider the WhatsApp
   Business API (via a provider like Twilio or 360dialog) to automate lead
   capture into the CRM. The current `wa.me` short links work for small
   volume but don't capture conversation data.

4. **Retargeting audiences in Google Ads**: Once GA4 has enough traffic
   data (1-2 months), create remarketing audiences for:
   - Course page visitors who didn't book
   - Contact form viewers who didn't submit
   These can be used in Google Ads display/search campaigns.

5. **Mailchimp nurture sequences**: Mailchimp integration is fully
   operational (subscribers are synced with tags from form submissions).
   Consider building automated email nurture sequences in Mailchimp based
   on subscriber tags (e.g., a 3-email drip for `patience-free-guide`
   downloaders, a follow-up sequence for `event-notification` signups
   who haven't booked).

## Environment variables reference

| Variable | Service | Purpose |
|---|---|---|
| `NEXT_PUBLIC_GTM_ID` | GTM | Container ID. If unset, GTM does not load. |
| `NEXT_PUBLIC_GTM_ALLOWED_HOSTS` | GTM | Host allowlist for GTM firing. |
| `NEXT_PUBLIC_SITE_ORIGIN` | SEO/GTM | Base URL for sitemap, canonicals, metadata, GTM host fallback. |
| `NEXT_PUBLIC_SITEMAP_LASTMOD` | SEO | Optional override for sitemap lastModified dates. |
| `NEXT_PUBLIC_WHATSAPP_URL` | Social | WhatsApp Business link for CTAs. |
| `NEXT_PUBLIC_BUSINESS_PHONE_NUMBER` | Social | Business phone for WhatsApp prefill. |
| `NEXT_PUBLIC_INSTAGRAM_URL` | Social | Instagram profile URL for structured data `sameAs`. |
| `NEXT_PUBLIC_LINKEDIN_URL` | Social | LinkedIn profile URL for structured data `sameAs`. |
| `NEXT_PUBLIC_EMAIL` | Contact | Business contact email. |
| `EVOLVESPROUTS_GOOGLE_SERVICE_ACCOUNT_JSON` | GCP | Service account credentials (GA4, GTM, Ads APIs). |
| `EVOLVESPROUTS_GA4_PROPERTY_ID` | GA4 | GA4 property ID for API queries. |
| `EVOLVESPROUTS_GOOGLE_CLIENT_EMAIL` | GCP | Service account email. |
| `EVOLVESPROUTS_GOOGLE_ADS_DEVELOPER_TOKEN` | Ads | Google Ads API developer token. |
| `EVOLVESPROUTS_GOOGLE_ADS_CUSTOMER_ID` | Ads | Google Ads customer ID. |
| `EVOLVESPROUTS_MAILCHIMP_API_KEY` | Email | Mailchimp API key for signup forms. |
| `EVOLVESPROUTS_MAILCHIMP_AUDIENCE_ID` | Email | Mailchimp audience/list ID. |
| `EVOLVESPROUTS_MAILCHIMP_SERVER_PREFIX` | Email | Mailchimp data center prefix. |
