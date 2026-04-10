# Plan: Transactional Confirmation Emails and Marketing Opt-In

**Status**: Draft — awaiting owner approval before implementation.

## 1. Goal

Add two capabilities to every public form submission flow (Contact Us, Media
Download, Booking):

1. **Transactional confirmation email** — always sent to the submitter via
   AWS SES immediately after a successful submission.
2. **Marketing opt-in** — an optional, unchecked-by-default checkbox on each
   form. When checked, the submitter is added to the Mailchimp audience with a
   flow-specific tag, and a shared welcome Customer Journey is triggered.

Additionally, the media download link delivery is migrated from a Mailchimp
Customer Journey to a direct SES email. The Mailchimp journey is kept active
during a transition period (both send), then removed in a follow-up.

---

## 2. Scope

### In scope

| Flow | Frontend form | Backend handler |
|------|--------------|----------------|
| Contact Us | `contact-us-form.tsx` / `contact-us-form-fields.tsx` | `public_legacy_proxy.py` → `handle_legacy_contact_us` |
| Media download | `media-form.tsx` | `public_media.py` → SNS → `media_processor/handler.py` |
| Booking (events, consultations, MBA) | `reservation-form.tsx` / `reservation-form-fields.tsx` | `public_legacy_proxy.py` → `handle_legacy_reservations` |

### Out of scope

- **Event notification form** (`event-notification.tsx`) — collects email only
  (no name), serves a different purpose (event alerts). Address in a follow-up.
- **Native reservation handler** (`public_reservations.py` at
  `/v1/reservations`) — not used by any frontend client today. Do not modify.
- **Re-consent campaign** for existing Mailchimp audience members who were
  subscribed without explicit opt-in — business/legal decision, separate from
  this work.
- **Mailchimp journey removal** for media download — planned for removal in a
  follow-up after the transition period. See §10.

---

## 3. Architecture principles

1. **Transactional and marketing are separate concerns.** SES handles promised
   content (confirmations, download links). Mailchimp handles audience
   membership and marketing journeys.
2. **Marketing subscribe requires explicit consent.** No Mailchimp audience
   add without the user checking the opt-in box.
3. **Transactional email must not depend on marketing.** If Mailchimp is down
   or the user did not opt in, the confirmation email still arrives.
4. **Marketing failures are non-blocking.** Mailchimp errors are logged but
   never fail the user response. The primary action (proxy / SNS publish)
   already succeeded.

---

## 4. Current state

| Flow | Email to user | Email to team | Mailchimp | Consent |
|------|--------------|--------------|-----------|---------|
| Contact Us | None | None (legacy handles) | None | None |
| Media download | Mailchimp journey (download link) | SES (sales notification) | Subscribe + tag + journey | **None** |
| Booking | None | None (legacy handles) | None | None |

### Problems

- **Media**: Download link delivery is coupled to Mailchimp subscribe. Users
  are added to the marketing audience without consent.
- **Contact Us**: No confirmation email. No marketing capability.
- **Booking**: No confirmation email for paying customers. No marketing
  capability.

---

## 5. Target state

| Flow | Email to user | Email to team | Mailchimp | Consent |
|------|--------------|--------------|-----------|---------|
| Contact Us | SES confirmation (always) | Unchanged (legacy) | Subscribe + tag + journey (if opted in) | Checkbox (unchecked) |
| Media download | SES download link (always) | SES sales notification (unchanged) | Subscribe + tag + journey (if opted in) | Checkbox (unchecked) |
| Booking | SES booking confirmation (always) | Unchanged (legacy) | Subscribe + tag + journey (if opted in) | Checkbox (unchecked) |

### Media transition period

During the transition the media flow sends the download link via **both** SES
and the existing Mailchimp Customer Journey. The Mailchimp journey continues to
fire for **all** media submissions (opted in or not) until the removal
follow-up. This ensures no user misses their download link if SES delivery has
issues in the initial rollout. See §10 for the removal checklist.

---

## 6. Detailed changes

### 6.1 Frontend — Contact Us form

**Files to modify:**

| File | Change |
|------|--------|
| `apps/public_www/src/components/sections/contact-us-form-fields.tsx` | 1. Make `firstName` field required: add required marker (`*`), add `required` attribute, add `aria-invalid` + error message (same pattern as email field). 2. Add marketing opt-in checkbox below the captcha field, above submit. Unchecked by default. Use locale content for label. |
| `apps/public_www/src/components/sections/contact-us-form.tsx` | 1. Add `isFirstNameTouched` state + blur handler. 2. Validate `firstName` is non-empty after sanitize in `handleSubmit`. 3. Add `marketingOptIn` boolean state (default `false`). 4. Include `first_name` (always) and `marketing_opt_in` in the POST body. |
| `apps/public_www/src/content/en.json` | Add under `contactUs.form`: `firstNameRequiredError` ("Please enter your name"), `marketingOptInLabel` ("Keep me updated with parenting tips and resources"). |
| `apps/public_www/src/content/zh-CN.json` | Chinese Simplified translations for the two new keys. |
| `apps/public_www/src/content/zh-HK.json` | Chinese Traditional translations for the two new keys. |
| `apps/public_www/tests/components/sections/contact-us-form.test.tsx` | Update: required first name validation, marketing checkbox presence and default state, payload includes `first_name` and `marketing_opt_in`. |
| `apps/public_www/tests/components/sections/contact-us-form-fields.test.tsx` | Update: first name required marker, error state, checkbox rendering. |

**Props changes to `ContactFormFields`:**

Add to the component interface:

- `hasFirstNameError: boolean`
- `marketingOptIn: boolean`
- `onFirstNameBlur: () => void`
- `onMarketingOptInChange: (checked: boolean) => void`

The content type (`ContactUsContent['form']`) will need the two new keys added
to the TypeScript type in `apps/public_www/src/content/index.ts` (or wherever
the content types are defined).

**Request body change:**

```
Before: { email_address, message, first_name?, phone_number? }
After:  { email_address, message, first_name, phone_number?, marketing_opt_in }
```

`first_name` becomes always-present (required). `marketing_opt_in` is a boolean
(default `false` if omitted).

### 6.2 Frontend — Media download form

**Files to modify:**

| File | Change |
|------|--------|
| `apps/public_www/src/components/sections/media-form.tsx` | Add `marketingOptIn` boolean state (default `false`). Add checkbox below email field, before captcha. Include `marketing_opt_in` in the POST body. |
| `apps/public_www/src/content/en.json` | Add under `resources`: `formMarketingOptInLabel` ("Keep me updated with parenting tips and resources"). |
| `apps/public_www/src/content/zh-CN.json` | Chinese Simplified translation. |
| `apps/public_www/src/content/zh-HK.json` | Chinese Traditional translation. |
| `apps/public_www/tests/components/sections/media-form.test.tsx` | Update: checkbox rendering, default state, payload includes `marketing_opt_in`. |

**Request body change:**

```
Before: { first_name, email, resource_key? }
After:  { first_name, email, resource_key?, marketing_opt_in }
```

### 6.3 Frontend — Booking reservation form

**Files to modify:**

| File | Change |
|------|--------|
| `apps/public_www/src/components/sections/booking-modal/reservation-form-fields.tsx` | Add marketing opt-in checkbox. Place it after the topics textarea and before the payment section. Visually distinguish from the required terms checkbox (terms has `*`, marketing does not). Pass `marketingOptIn` and `onMarketingOptInChange` as new props. |
| `apps/public_www/src/components/sections/booking-modal/reservation-form.tsx` | Add `marketingOptIn` boolean state (default `false`). Include `marketing_opt_in` in the reservation payload. Pass the `locale` prop value into the POST body as `locale` (string, e.g. `"en"`, `"zh-CN"`, `"zh-HK"`). |
| `apps/public_www/src/lib/reservations-data.ts` | Add `marketing_opt_in?: boolean` and `locale?: string` to `ReservationSubmissionPayload`. |
| `apps/public_www/src/content/en.json` | Add under `bookingModal.paymentModal`: `marketingOptInLabel` ("Keep me updated with parenting tips and resources"). |
| `apps/public_www/src/content/zh-CN.json` | Chinese Simplified translation. |
| `apps/public_www/src/content/zh-HK.json` | Chinese Traditional translation. |
| Tests for the reservation form components. | Update: checkbox rendering, default state, payload includes `marketing_opt_in` and `locale`. |

**Request body change:**

```
Before: { full_name, email, phone_number, cohort_age, cohort_date, ... }
After:  { full_name, email, phone_number, cohort_age, cohort_date, ..., marketing_opt_in, locale }
```

`locale` is passed from the frontend so the backend can select the correct
email template language.

### 6.4 Frontend — Shared checkbox component

All three forms need an identical marketing opt-in checkbox. To avoid
duplication, extract a shared component:

**New file:**
`apps/public_www/src/components/shared/marketing-opt-in-checkbox.tsx`

Props: `label: string`, `checked: boolean`, `onChange: (checked: boolean) => void`.

Renders a styled `<label>` with `<input type="checkbox">` using existing
`es-form-*` CSS classes. No required marker. Accessible (`aria-*` attributes
not needed beyond the label association).

### 6.5 Backend — Shared marketing subscribe helper

**New file:** `backend/src/app/services/marketing_subscribe.py`

Purpose: reusable, non-blocking wrapper for Mailchimp audience subscribe +
tag + welcome journey trigger. Called from all three flows.

```python
def subscribe_to_marketing(
    *,
    email: str,
    first_name: str,
    tag_name: str,
    merge_fields: dict[str, str] | None = None,
    logger: Logger,
) -> bool:
    """Add a contact to the Mailchimp audience with a tag and trigger the
    welcome journey. Returns True if the subscribe succeeded.

    Non-blocking: logs errors but never raises.
    """
```

Implementation:

1. Call `add_subscriber_with_tag(email=email, first_name=first_name,
   tag_name=tag_name, merge_fields=merge_fields)` with `run_with_retry`
   (3 attempts, 1s base delay, `_is_retryable_mailchimp_exception`).
2. On success, call `trigger_customer_journey(email=email,
   journey_id=<env>, step_id=<env>)` with `run_with_retry`.
3. Catch and log all exceptions. Return `False` on failure.

Environment variables consumed:
- `MAILCHIMP_API_SECRET_ARN` (existing)
- `MAILCHIMP_LIST_ID` (existing)
- `MAILCHIMP_SERVER_PREFIX` (existing)
- `MAILCHIMP_WELCOME_JOURNEY_ID` (new)
- `MAILCHIMP_WELCOME_JOURNEY_STEP_ID` (new)

These are the **shared** welcome journey IDs — all three flows trigger the same
journey.

### 6.6 Backend — New email templates

**Pattern to follow:** `backend/src/app/templates/media_lead.py` and
`backend/src/app/templates/types.py` (`EmailContent` dataclass).

#### 6.6.1 Contact Us confirmation

**New file:** `backend/src/app/templates/contact_confirmation.py`

`render_contact_confirmation_email(*, first_name, locale) -> EmailContent`

Content:
- Subject: "We received your message — Evolve Sprouts"
- Body: Greeting with first name. "We received your message and will get back
  to you within 24–48 hours." Links: FAQ page URL, WhatsApp URL. Closing.
- HTML: Branded template matching the `media_lead.py` styling approach
  (inline CSS, 600px max-width, Evolve Sprouts header).

The template must support three locales: `en`, `zh-CN`, `zh-HK`. Use a
locale-keyed dictionary of strings within the template module.

**Environment variables consumed:**
- `PUBLIC_WWW_BASE_URL` (new — for FAQ link; derive from existing
  `publicWwwDomainName` CDK parameter)
- `WHATSAPP_URL` (new — for WhatsApp link in email)
- `SES_SENDER_EMAIL` (existing on processors; new on admin Lambda)
- `SUPPORT_EMAIL` (existing on processors; new on admin Lambda)

#### 6.6.2 Media download link

**New file:** `backend/src/app/templates/media_download_link.py`

`render_media_download_email(*, first_name, media_name, download_url, locale) -> EmailContent`

Content:
- Subject: "Your free guide is ready — Evolve Sprouts"
- Body: Greeting with first name. "Here is your download link for {media_name}."
  Prominent download button/link. "If the button doesn't work, copy this URL:
  {download_url}." Closing.
- HTML: Branded template. Prominent CTA button for the download URL.

**Environment variables consumed:**
- `SES_SENDER_EMAIL` (already on media processor)
- The download URL is computed by `_ensure_share_link_url_for_asset()` in the
  media processor — no new env var needed.

#### 6.6.3 Booking confirmation

**New file:** `backend/src/app/templates/booking_confirmation.py`

`render_booking_confirmation_email(*, full_name, email, course_label,
month_label, schedule_date_label, schedule_time_label, payment_method,
total_amount, stripe_payment_intent_id, locale) -> EmailContent`

Content:
- Subject: "Booking confirmed — {course_label} — Evolve Sprouts"
- Body: Greeting with full name. "Thank you for your booking!" Details table:
  course/event name, date/time, payment amount (HKD), payment method. If
  non-Stripe payment method: "Your reservation is pending until payment is
  confirmed." WhatsApp link for questions. Closing.
- HTML: Branded template. Details table. WhatsApp CTA.

**Environment variables consumed:**
- `PUBLIC_WWW_BASE_URL` (new — for WhatsApp link if not hardcoded)
- `WHATSAPP_URL` (new)
- `SES_SENDER_EMAIL` (new on admin Lambda)

### 6.7 Backend — Contact Us handler changes

**File:** `backend/src/app/api/public_legacy_proxy.py`

Modify `handle_legacy_contact_us`:

```
Current flow:
  1. Validate method → parse body → proxy to legacy API → return response

New flow:
  1. Validate method → parse body → proxy to legacy API
  2. If proxy returned a success status (200 or 202):
     a. Extract email_address, first_name, marketing_opt_in from the
        ORIGINAL parsed body (not the proxy response).
     b. Determine locale: read Accept-Language header from the original
        event, or default to "en".
     c. Send SES confirmation email (fire-and-forget with error logging).
     d. If marketing_opt_in is truthy AND first_name is non-empty:
        call subscribe_to_marketing (fire-and-forget).
  3. Return the proxy response (unchanged).
```

The SES send and Mailchimp calls MUST NOT delay or alter the response. Wrap
each in a try/except that logs and swallows errors.

**Important:** The legacy proxy handler currently does not parse the body for
its own use — it forwards it opaquely. For the post-success hooks, we need to
access the parsed body. The body is already parsed via `parse_body(event)` in
`_handle_legacy_proxy`. Refactor to make the parsed payload available to the
caller: either return it alongside the response, or have the specific handler
(`handle_legacy_contact_us`) parse the body separately before calling the
generic proxy.

**Recommended approach:** Have `handle_legacy_contact_us` call `parse_body`
first, then pass the result to a slightly refactored `_handle_legacy_proxy`
that accepts an already-parsed payload. This avoids double-parsing and keeps
the generic proxy clean.

### 6.8 Backend — Booking handler changes

**File:** `backend/src/app/api/public_legacy_proxy.py`

Modify `handle_legacy_reservations`:

Same pattern as Contact Us. After successful proxy response:

1. Extract `full_name` (→ derive first name by splitting on first space),
   `email`, `phone_number`, `cohort_date`, `price`, `payment_method`,
   `stripe_payment_intent_id`, `marketing_opt_in`, `locale` from the original
   parsed body.
2. Determine locale: use `locale` from the body (passed by the frontend), fall
   back to `"en"`.
3. Send SES booking confirmation email (fire-and-forget).
4. If `marketing_opt_in` is truthy AND derived first name is non-empty:
   call `subscribe_to_marketing` with tag `booking-customer`
   (fire-and-forget).

**Note on `full_name` → `first_name`:** The booking form collects `full_name`
(e.g., "Jane Smith"). Mailchimp's `FNAME` merge field expects a first name.
Split `full_name` on the first whitespace and use the first segment. If the
name has no spaces, use the entire string. This is a best-effort extraction —
acceptable for a merge field.

### 6.9 Backend — Media processor changes

**File:** `backend/src/app/api/public_media.py`

Add `marketing_opt_in` to the SNS message payload:

```python
# In handle_media_request, when building message_payload:
message_payload = {
    "event_type": _EVENT_TYPE,
    "first_name": first_name,
    "email": email,
    "submitted_at": ...,
    "request_id": ...,
    "marketing_opt_in": body.get("marketing_opt_in", False),
}
# resource_key added conditionally as before
```

**File:** `backend/lambda/media_processor/handler.py`

Modify `_process_message`:

```
Current flow:
  1. Upsert contact in DB            (always)
  2. add_subscriber_with_tag()        (always)
  3. trigger_customer_journey()       (always, if step 2 succeeded)
  4. SES to sales team                (always)

New flow:
  1. Upsert contact in DB            (always)
  2. SES download link to user        (always — NEW)
  3. SES to sales team                (always — unchanged)
  4. add_subscriber_with_tag()        (TRANSITION: always; POST-TRANSITION: only if marketing_opt_in)
  5. trigger_customer_journey()       (TRANSITION: always, if step 4 succeeded; POST-TRANSITION: only if marketing_opt_in AND step 4 succeeded)
```

**Step 2 detail:** After `_ensure_share_link_url_for_asset` returns the
download URL, call the new `render_media_download_email` template and send via
`send_email`. Use `SES_SENDER_EMAIL` as the source, send to the user's email.

**Transition behavior:** During the transition period, steps 4 and 5 remain
unconditional (matching current behavior). The `marketing_opt_in` flag is read
from the message but only used to set a metadata field on the sales lead event
for tracking. After the transition, the condition changes to gate steps 4–5
behind `marketing_opt_in`.

To make the transition switchable, introduce an environment variable:

`MAILCHIMP_REQUIRE_MARKETING_CONSENT` — when `"true"`, Mailchimp subscribe is
gated behind `marketing_opt_in`. When empty or `"false"` (default during
transition), Mailchimp subscribe fires unconditionally as it does today.

This same env var can be used across all flows for consistency, but it only
matters for the media processor during the transition (contact-us and booking
have no existing Mailchimp integration to preserve).

### 6.10 Backend — Infrastructure (CDK) changes

**File:** `backend/infrastructure/lib/api-stack.ts`

#### 6.10.1 Admin Lambda SES permissions

Add `ses:SendEmail` and `ses:SendRawEmail` IAM policy to `adminFunction`:

```typescript
adminFunction.addToRolePolicy(
  new iam.PolicyStatement({
    actions: ["ses:SendEmail", "ses:SendRawEmail"],
    resources: [sesSenderIdentityArn, sesSenderDomainIdentityArn],
  })
);
```

#### 6.10.2 Admin Lambda environment variables

Add the following to `adminFunction`:

```typescript
adminFunction.addEnvironment("SES_SENDER_EMAIL", sesSenderEmail.valueAsString);
adminFunction.addEnvironment("SUPPORT_EMAIL", supportEmail.valueAsString);
adminFunction.addEnvironment("MAILCHIMP_API_SECRET_ARN", mailchimpApiSecret.secretArn);
adminFunction.addEnvironment("MAILCHIMP_LIST_ID", mailchimpListId.valueAsString);
adminFunction.addEnvironment("MAILCHIMP_SERVER_PREFIX", mailchimpServerPrefix.valueAsString);
adminFunction.addEnvironment("MAILCHIMP_WELCOME_JOURNEY_ID", mailchimpWelcomeJourneyId.valueAsString);
adminFunction.addEnvironment("MAILCHIMP_WELCOME_JOURNEY_STEP_ID", mailchimpWelcomeJourneyStepId.valueAsString);
adminFunction.addEnvironment("PUBLIC_WWW_BASE_URL", `https://${publicWwwDomainName.valueAsString}`);
adminFunction.addEnvironment("WHATSAPP_URL", whatsappUrl.valueAsString);
```

#### 6.10.3 New CfnParameters

```typescript
const mailchimpWelcomeJourneyId = new cdk.CfnParameter(
  this, "MailchimpWelcomeJourneyId", {
    type: "String",
    default: "",
    description: "Mailchimp Customer Journey ID for welcome flow (shared across contact/media/booking opt-ins)",
  }
);

const mailchimpWelcomeJourneyStepId = new cdk.CfnParameter(
  this, "MailchimpWelcomeJourneyStepId", {
    type: "String",
    default: "",
    description: "Mailchimp Customer Journey step ID for welcome flow entry point",
  }
);

const whatsappUrl = new cdk.CfnParameter(
  this, "WhatsappUrl", {
    type: "String",
    default: "",
    description: "WhatsApp contact URL included in transactional confirmation emails",
  }
);
```

`PUBLIC_WWW_BASE_URL` is derived from the existing `publicWwwDomainName`
parameter — no new CfnParameter needed.

#### 6.10.4 Admin Lambda Secrets Manager read

The admin Lambda needs to read the Mailchimp API secret. The
`mediaRequestProcessor` already has this grant. Add the same for
`adminFunction`:

```typescript
mailchimpApiSecret.grantRead(adminFunction);
```

Where `mailchimpApiSecret` is the existing imported secret from
`MailchimpApiSecretArn`.

#### 6.10.5 Media processor environment variable

Add to `mediaRequestProcessor` environment:

```typescript
MAILCHIMP_REQUIRE_MARKETING_CONSENT: mailchimpRequireMarketingConsent.valueAsString,
```

With a new parameter:

```typescript
const mailchimpRequireMarketingConsent = new cdk.CfnParameter(
  this, "MailchimpRequireMarketingConsent", {
    type: "String",
    default: "false",
    allowedValues: ["true", "false"],
    description: "When true, Mailchimp subscribe requires marketing_opt_in. Set to false during transition.",
  }
);
```

### 6.11 Documentation updates

| File | Change |
|------|--------|
| `docs/api/public.yaml` | Add `marketing_opt_in` (boolean, optional, default false) to `ContactUsSubmissionRequest`, `MediaRequestSubmissionRequest`. Mark `first_name` as required on Contact Us. Add `marketing_opt_in` and `locale` to the reservation legacy proxy body description. Document confirmation email behavior in endpoint descriptions. |
| `docs/architecture/aws-messaging.md` | Add section for contact-us and booking transactional emails (SES, synchronous from Admin Lambda). Update media flow: SES sends download link directly, Mailchimp conditional on consent (with transition note). |
| `docs/architecture/lambdas.md` | Update Admin Lambda: add SES permissions, new env vars (`SES_SENDER_EMAIL`, `SUPPORT_EMAIL`, Mailchimp vars, `PUBLIC_WWW_BASE_URL`, `WHATSAPP_URL`). Update Media Processor: add `MAILCHIMP_REQUIRE_MARKETING_CONSENT` env var, note SES download link. |
| `docs/architecture/aws-assets-map.md` | Add new CfnParameters: `MailchimpWelcomeJourneyId`, `MailchimpWelcomeJourneyStepId`, `WhatsappUrl`, `MailchimpRequireMarketingConsent`. |

---

## 7. Mailchimp tags

| Flow | Tag name | Applied when |
|------|----------|-------------|
| Contact Us | `contact-us-inquiry` | User opts in |
| Media download | `public-www-media-{resource_key}-requested` (existing) | Transition: always. Post-transition: user opts in |
| Booking | `booking-customer` | User opts in |

---

## 8. Execution order

Implementation should proceed in this order to minimize risk and allow
incremental testing:

### Phase 1: Backend infrastructure and shared code

1. CDK changes (§6.10): Admin Lambda SES grant, env vars, new parameters.
2. New shared helper (§6.5): `marketing_subscribe.py`.
3. New email templates (§6.6): all three.
4. Run `pre-commit run ruff-format --all-files` after all Python changes.
5. Run `bash scripts/validate-cursorrules.sh`.

### Phase 2: Backend handler changes

6. Contact Us handler (§6.7): post-success SES + Mailchimp hook.
7. Booking handler (§6.8): post-success SES + Mailchimp hook.
8. Media API (§6.9): pass `marketing_opt_in` through SNS payload.
9. Media processor (§6.9): add SES download link, transition flag for
   Mailchimp.

### Phase 3: Frontend changes

10. Shared checkbox component (§6.4).
11. Contact Us form (§6.1): required first name + checkbox + payload.
12. Media form (§6.2): checkbox + payload.
13. Booking form (§6.3): checkbox + payload + locale.
14. Update all affected tests.
15. Update locale content in all three JSON files.

### Phase 4: Documentation

16. OpenAPI spec updates (§6.11).
17. Architecture docs updates (§6.11).

---

## 9. Testing checklist

### Backend unit tests

- [ ] `marketing_subscribe.py`: success path, Mailchimp API error (non-blocking),
  missing env vars, empty email/name.
- [ ] `contact_confirmation.py`: renders all three locales, subject and body
  contain expected placeholders.
- [ ] `media_download_link.py`: renders all three locales, download URL is
  present in body.
- [ ] `booking_confirmation.py`: renders all three locales, all booking fields
  present, pending-payment note for non-Stripe.
- [ ] `public_legacy_proxy.py` (contact-us): successful proxy triggers SES +
  Mailchimp when opted in; failed proxy triggers neither; Mailchimp failure
  does not affect response; missing first_name skips Mailchimp.
- [ ] `public_legacy_proxy.py` (booking): same as above, plus locale
  passthrough, full_name → first_name extraction.
- [ ] `public_media.py`: `marketing_opt_in` included in SNS payload.
- [ ] `media_processor/handler.py`: SES download link sent on success;
  Mailchimp gated by transition flag + opt-in; SES failure logged but
  processing continues.

### Frontend component tests

- [ ] Contact Us form: first name required validation, checkbox unchecked by
  default, payload shape, success/error paths unchanged.
- [ ] Media form: checkbox unchecked by default, payload shape.
- [ ] Booking form: checkbox unchecked by default, checkbox visually distinct
  from terms, payload includes `marketing_opt_in` and `locale`.
- [ ] Shared checkbox component: renders label, toggles state, accessible.

### Integration / manual testing

- [ ] Submit Contact Us with opt-in → receive SES confirmation + appear in
  Mailchimp audience with `contact-us-inquiry` tag.
- [ ] Submit Contact Us without opt-in → receive SES confirmation only, not
  added to Mailchimp.
- [ ] Submit media form with opt-in → receive SES download link + Mailchimp
  journey email (transition). Appear in audience.
- [ ] Submit media form without opt-in → receive SES download link + Mailchimp
  journey email (transition). Appear in audience (transition — legacy behavior
  preserved).
- [ ] Submit booking with opt-in → receive SES booking confirmation + appear in
  Mailchimp audience with `booking-customer` tag.
- [ ] Submit booking without opt-in → receive SES booking confirmation only.
- [ ] Verify emails render correctly in Gmail, Outlook, Apple Mail.
- [ ] Verify Chinese locale emails render correctly.
- [ ] Verify Mailchimp welcome journey triggers.

---

## 10. Media Mailchimp transition → removal checklist

After the SES download link has been confirmed working in production for a
sufficient period (recommended: 2 weeks of monitoring):

1. Set `MailchimpRequireMarketingConsent` parameter to `"true"` in production
   deploy.
2. Verify: media submissions without opt-in no longer appear in Mailchimp
   audience. Media submissions with opt-in still appear.
3. Verify: all users still receive their download link via SES regardless of
   opt-in.
4. Disable the Mailchimp "Free Resource" Customer Journey in the Mailchimp
   dashboard (so it stops sending the download link email on its own).
5. Optionally remove `MAILCHIMP_FREE_RESOURCE_JOURNEY_ID` and
   `MAILCHIMP_FREE_RESOURCE_JOURNEY_STEP_ID` env vars from the media
   processor (or leave them; empty values already disable the trigger).
6. Remove `MAILCHIMP_REQUIRE_MARKETING_CONSENT` env var and the conditional
   logic — Mailchimp subscribe is now always gated by `marketing_opt_in`.
7. Update `docs/architecture/aws-messaging.md` to remove transition notes.

---

## 11. Risks and mitigations

| Risk | Impact | Mitigation |
|------|--------|-----------|
| SES send failure on contact-us / booking | User does not receive confirmation email | Log error. Return success to user (primary action succeeded). Monitor CloudWatch for SES errors. Consider DLQ retry in a follow-up. |
| SES send failure on media download link | User does not receive download link | During transition: Mailchimp journey is backup. Post-transition: monitor closely; add DLQ retry. |
| Mailchimp API failure after opt-in | User not added to audience | Non-blocking. Log warning. User still gets SES email. Can reconcile via admin tools later. |
| Added latency on contact-us / booking responses | Slower form submission | SES via VPC endpoint: sub-second. Mailchimp via HTTP proxy: 1-3s but fire-and-forget (non-blocking). Total added latency to response: ~200-500ms (SES only; Mailchimp does not block response). |
| Legacy proxy receives unknown `marketing_opt_in` field | Legacy API may reject or ignore it | Legacy APIs typically ignore unknown fields. The field is consumed on our side after the proxy returns. If the legacy API rejects it, strip `marketing_opt_in` from the proxied body and only read it from the pre-parsed body. **This must be verified.** |
| `full_name` → `first_name` extraction is lossy | Mailchimp FNAME may be imprecise for non-Western names | Acceptable for a merge field. If the user has a single-word name, the entire name is used. |
| Contact Us `first_name` now required | Existing form users may have muscle memory to skip it | Field was already visually present; only validation changes. Low risk. |
| Booking form locale accuracy | Email sent in wrong language | Frontend passes current route locale. Backend validates against `["en", "zh-CN", "zh-HK"]` and defaults to `"en"`. |

---

## 12. Open questions requiring answers before implementation

### Q1: Legacy API field passthrough

The legacy proxy currently forwards the entire JSON body to the upstream
legacy API. The new fields (`marketing_opt_in`, `locale`) will be included in
the forwarded body. **Does the legacy API tolerate unknown fields, or will it
reject them?**

If it rejects them: the handler must strip these fields from the body before
proxying, but still read them from the original parsed payload. This adds a
small amount of complexity to the proxy refactor.

### Q2: Mailchimp welcome journey setup

The plan assumes a single shared Mailchimp Customer Journey (welcome flow)
already exists or will be created in the Mailchimp dashboard. **Has this
journey been created? What are its journey ID and step ID?**

If not yet created: the `MAILCHIMP_WELCOME_JOURNEY_ID` and
`MAILCHIMP_WELCOME_JOURNEY_STEP_ID` parameters can be deployed as empty
strings (which disables the trigger), and the journey can be configured later
without a code change.

### Q3: WhatsApp URL source

The confirmation email templates include a WhatsApp link. Currently, the
WhatsApp URL is available in the frontend via `resolvePublicSiteConfig()` and
in locale content. **What is the canonical source for the WhatsApp URL on the
backend?**

Options:
- A new CDK parameter `WhatsappUrl` (proposed in §6.10.3)
- Derive from an existing config source

### Q4: Email sender address for transactional confirmations

The current SES sender addresses are:
- `no-reply@evolvesprouts.com` (`SesSenderEmail`) — used for internal
  notifications
- `hello@evolvesprouts.com` (`AuthEmailFromAddress`) — used for auth emails

**Which address should be the From address for customer-facing confirmation
emails?** Using `hello@` feels more personal; using `no-reply@` is more
standard for transactional. A new verified identity may be needed if a
different address is desired (e.g., `bookings@evolvesprouts.com`).

### Q5: Contact Us form — `first_name` and legacy API

Making `first_name` required on the frontend means the field will always be
present in the proxied body. **Does the legacy API expect or validate
`first_name`?** If the legacy API does not expect it, this is fine (it will
ignore it). But if the legacy API has strict schema validation that rejects
unknown or newly-required fields, we need to account for that.

### Q6: Booking form — which fields are available in the legacy proxy body?

The booking form sends fields like `cohort_date`, `price`, `payment_method` to
the legacy proxy, but also builds a richer `ReservationSummary` object for the
thank-you modal that includes `courseLabel`, `locationName`, `eventTitle`, etc.

**The legacy proxy only has access to the POST body, not the
`ReservationSummary`.** The booking confirmation email needs the course/event
name. The POST body includes `cohort_age` and `cohort_date` but not
`course_label` directly (it is in the legacy proxy body for the native handler
as `courseLabel`, but the legacy proxy receives whatever the frontend sends).

Looking at the payload shape sent to `/v1/legacy/reservations`, it does NOT
include `course_label` or event name. The frontend `ReservationSubmissionPayload`
has: `full_name`, `email`, `phone_number`, `cohort_age`, `cohort_date`,
`comments`, `discount_code`, `price`, `reservation_pending_until_payment_confirmed`,
`agreed_to_terms_and_conditions`, `payment_method`, `stripe_payment_intent_id`.

**We need to add additional display fields to the POST body** for the
confirmation email to be useful: `course_label`, `schedule_date_label`,
`schedule_time_label`, and optionally `location_name`.

This means:
- `ReservationSubmissionPayload` gains: `course_label?: string`,
  `schedule_date_label?: string`, `schedule_time_label?: string`,
  `location_name?: string`.
- `reservation-form.tsx` includes these from `reservationSummary` in the POST
  body.
- The legacy API must tolerate these additional fields (see Q1).

### Q7: Email HTML template approach

The plan proposes Python string-template HTML emails (matching the existing
`media_lead.py` pattern). This is simple but produces basic-looking emails.

**Is a richer HTML email template acceptable, or should we invest in a proper
email templating system (e.g., Jinja2, MJML)?** The current approach (inline
CSS, Python f-strings) works but is hard to maintain for complex layouts.

For this iteration, the plan assumes the existing approach (Python
string-format templates with inline CSS). A templating system upgrade can be
a follow-up.

### Q8: Rate limiting on SES sends

Contact Us and booking submissions are already protected by Cloudflare
Turnstile. **Is the current SES sending rate limit sufficient for the expected
volume, or do we need to request an SES limit increase?**

Default SES sandbox: 200 emails/day. Production SES: typically 50,000/day or
higher. **Verify the account is in SES production mode and the sending rate is
adequate.**

---

## 13. File inventory (complete)

### New files

| Path | Purpose |
|------|---------|
| `apps/public_www/src/components/shared/marketing-opt-in-checkbox.tsx` | Shared checkbox component |
| `backend/src/app/services/marketing_subscribe.py` | Shared Mailchimp subscribe helper |
| `backend/src/app/templates/contact_confirmation.py` | Contact Us confirmation email template |
| `backend/src/app/templates/media_download_link.py` | Media download link email template |
| `backend/src/app/templates/booking_confirmation.py` | Booking confirmation email template |

### Modified files

| Path | Summary of change |
|------|------------------|
| `apps/public_www/src/components/sections/contact-us-form.tsx` | Required first name, marketing opt-in state, updated payload |
| `apps/public_www/src/components/sections/contact-us-form-fields.tsx` | Required first name validation, marketing checkbox |
| `apps/public_www/src/components/sections/media-form.tsx` | Marketing opt-in state, checkbox, updated payload |
| `apps/public_www/src/components/sections/booking-modal/reservation-form.tsx` | Marketing opt-in state, locale in payload |
| `apps/public_www/src/components/sections/booking-modal/reservation-form-fields.tsx` | Marketing checkbox |
| `apps/public_www/src/lib/reservations-data.ts` | Add `marketing_opt_in`, `locale`, display fields to payload type |
| `apps/public_www/src/content/en.json` | New locale keys for all three forms |
| `apps/public_www/src/content/zh-CN.json` | Chinese Simplified translations |
| `apps/public_www/src/content/zh-HK.json` | Chinese Traditional translations |
| `backend/src/app/api/public_legacy_proxy.py` | Post-success hooks for contact-us and booking |
| `backend/src/app/api/public_media.py` | Pass `marketing_opt_in` in SNS payload |
| `backend/lambda/media_processor/handler.py` | SES download link, transition-gated Mailchimp |
| `backend/infrastructure/lib/api-stack.ts` | Admin Lambda SES grant, env vars, new parameters |
| `docs/api/public.yaml` | Schema updates for all three endpoints |
| `docs/architecture/aws-messaging.md` | New transactional email flows, updated media flow |
| `docs/architecture/lambdas.md` | Updated Admin Lambda and Media Processor descriptions |
| `docs/architecture/aws-assets-map.md` | New parameters |
| Tests (multiple files) | Updated for new fields, checkbox, payload shapes |
