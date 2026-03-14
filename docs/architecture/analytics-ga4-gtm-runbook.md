# GA4 + GTM Analytics Runbook (Public Website)

This runbook defines a practical GA4/GTM setup for the current public website
flows and provides a step-by-step implementation guide.

## Scope

Applies to `apps/public_www` and current user journeys:

- Contact form (`POST /v1/contact-us`)
- Media request form (`POST /v1/media-request`)
- Community / event signup forms (`POST /v1/contact-us` with prefilled message)
- My Best Auntie booking flow (`POST /v1/reservations`)
- WhatsApp CTAs (floating and section-level)

## Tracking architecture

- Delivery mechanism: **Google Tag Manager** (`NEXT_PUBLIC_GTM_ID`)
- Runtime firing gate: `NEXT_PUBLIC_GTM_ALLOWED_HOSTS` (or fallback to host from
  `NEXT_PUBLIC_SITE_ORIGIN`)
- Analytics destination: **GA4 property + web stream**
- Principle: no hardcoded GA4 event plumbing in business components unless
  needed for precision; use GTM where possible and keep naming centralized.

## Event taxonomy (v1)

### Naming rules

- Event names: `lower_snake_case`, verb-first
- Parameter names: `lower_snake_case`
- Never send PII (no email, phone, full name, free-text message)

### Common parameters (send with every custom event)

- `page_path`
- `page_title`
- `page_locale`
- `section_id`
- `cta_location`
- `environment`

### Event catalog

| Event | Trigger | Required params | Key event |
|---|---|---|---|
| `whatsapp_click` | WhatsApp CTA click | `section_id`, `cta_location` | No |
| `contact_form_submit_attempt` | Contact form submit attempt | `section_id='contact-us-form'` | No |
| `contact_form_submit_success` | `/v1/contact-us` success | `section_id`, `form_type='contact_us'` | Yes |
| `contact_form_submit_error` | `/v1/contact-us` error | `section_id`, `form_type='contact_us'`, `error_type` | No |
| `media_form_open` | Media CTA expands form | `section_id`, `resource_key` | No |
| `media_form_submit_success` | `/v1/media-request` success | `section_id`, `resource_key` | Yes |
| `media_form_submit_error` | `/v1/media-request` error | `section_id`, `resource_key`, `error_type` | No |
| `community_signup_submit_success` | Sprouts/Event signup success | `section_id`, `form_type` | Yes |
| `community_signup_submit_error` | Sprouts/Event signup error | `section_id`, `form_type`, `error_type` | No |
| `booking_modal_open` | Booking modal opens | `section_id='my-best-auntie-booking'`, `age_group`, `cohort_label` | No |
| `booking_age_selected` | Age option selected | `section_id`, `age_group` | No |
| `booking_date_selected` | Date/cohort selected | `section_id`, `cohort_label`, `is_fully_booked` | No |
| `booking_confirm_pay_click` | Confirm-and-pay CTA click | `section_id`, `age_group`, `cohort_label`, `price` | No |
| `booking_payment_method_selected` | Payment method switch | `section_id`, `payment_method` | No |
| `booking_discount_apply_success` | Discount code valid | `section_id`, `discount_type`, `discount_amount` | No |
| `booking_discount_apply_error` | Discount code invalid/error | `section_id`, `error_type` | No |
| `booking_submit_success` | `/v1/reservations` success | `section_id`, `payment_method`, `total_amount`, `age_group`, `cohort_date` | Yes |
| `booking_submit_error` | `/v1/reservations` error | `section_id`, `payment_method`, `error_type` | No |
| `booking_thank_you_view` | Thank-you modal shown | `section_id`, `payment_method`, `total_amount` | No |
| `booking_receipt_print_click` | Print action in thank-you modal | `section_id`, `payment_method`, `total_amount` | No |

## GA4 setup: step-by-step

1. Create or confirm a GA4 property.
2. Create or confirm a **Web Data Stream** for the public site domain.
3. In GA4 Admin, create event-scoped custom dimensions for:
   - `section_id`, `cta_location`, `form_type`, `payment_method`, `age_group`,
     `cohort_label`, `cohort_date`, `resource_key`, `error_type`, `discount_type`
4. Create custom metrics for:
   - `total_amount`, `discount_amount`
5. Mark key events:
   - `contact_form_submit_success`
   - `media_form_submit_success`
   - `community_signup_submit_success`
   - `booking_submit_success`
6. Configure internal traffic filters for team IP ranges.
7. Configure unwanted referral exclusions and cross-domain linking if needed.
8. Enable BigQuery export for long-term event analysis.

## GTM setup: step-by-step

1. Create or confirm GTM container.
2. Add GA4 configuration tag and fire on All Pages.
3. Create GA4 event tags for taxonomy events.
4. Create triggers for existing UI hooks and flows:
   - WhatsApp links
   - Contact/media/community/event form interactions
   - Booking modal and reservation actions
5. Define variables for common parameters:
   - page metadata (`page_path`, `page_title`)
   - locale and section context (`page_locale`, `section_id`, `cta_location`)
   - booking context (`payment_method`, `cohort_label`, `age_group`, amounts)
6. Attach common parameters to all event tags.
7. Use GTM Preview to validate every event and parameter.
8. Validate in GA4 DebugView.
9. Publish GTM workspace version after validation.

## Deployment and host gating checklist

1. Set `NEXT_PUBLIC_GTM_ID` in GitHub Variables.
2. Set `NEXT_PUBLIC_GTM_ALLOWED_HOSTS` (recommended) as comma-separated hosts.
3. If `NEXT_PUBLIC_GTM_ALLOWED_HOSTS` is unset, confirm
   `NEXT_PUBLIC_SITE_ORIGIN` resolves to the intended production host.
4. Verify staging and preview hosts are excluded unless explicitly intended.

## Data quality and governance checklist

- [ ] No PII in event names or parameters
- [ ] Event names follow taxonomy
- [ ] Required common parameters present
- [ ] GA4 custom dimensions/metrics registered for used params
- [ ] Key events configured
- [ ] Internal traffic filter active
- [ ] BigQuery export active
- [ ] GTM change notes/version comments recorded

## Programmatic setup prerequisites (for service-account automation)

To automate GA4/GTM setup from a script, ensure the service account has:

- GA4 property **Editor** (or Admin)
- GTM container **Admin** with workspace + publish permissions

Required identifiers:

- `GA4_PROPERTY_ID`
- `GA4_WEB_DATA_STREAM_ID`
- `GTM_ACCOUNT_ID`
- `GTM_CONTAINER_ID`
- `GTM_WORKSPACE_ID`

