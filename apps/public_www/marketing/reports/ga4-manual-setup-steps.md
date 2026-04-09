# GA4 Manual Setup Steps

Configuration changes that must be done in the GA4 UI (the Admin API does
not expose these settings).

**GA4 Property**: 525520074 (Evolve Sprouts Website)
**Data Stream**: Evolve Sprouts Production (G-YJTWSCB01P)

---

## 1. Internal Traffic Filter

Filters out developer, agent, and preview traffic from GA4 reports.

### Step 1: Define internal traffic

1. Go to **GA4 Admin** > **Data Collection and Modification** > **Data Streams**
2. Click **Evolve Sprouts Production**
3. Click **Configure Tag Settings** > **Show all**
4. Click **Define Internal Traffic** > **Create**
5. Fill in:
   - **Rule name**: `Developer / Agent Traffic`
   - **traffic_type value**: `internal`
   - **IP addresses**: Add your home/office IP (use "IP address equals" or
     "IP address begins with")
6. Click **Create**

### Step 2: Activate the filter

1. Go to **GA4 Admin** > **Data Collection and Modification** > **Data Filters**
2. Find **Internal Traffic** (it exists by default in testing mode)
3. Click on it and change **Filter state** from **Testing** to **Active**
4. Click **Save**

After activation, sessions from matched IPs will be excluded from all
reports. Allow 24-48 hours for the filter to take full effect.

---

## 2. Funnel Exploration Report

A saved funnel exploration for the booking flow, showing drop-off at each
step.

### Steps to create

1. Go to **GA4** > **Explore** > **Funnel exploration** (or click the +
   button and select "Funnel exploration")
2. Configure the funnel steps:

| Step | Event name | Description |
|---|---|---|
| 1 | `booking_age_selected` | User selects an age group |
| 2 | `booking_date_selected` | User selects a cohort date |
| 3 | `booking_confirm_pay_click` | User clicks "Confirm & Pay" (opens the payment modal) |
| 4 | `booking_payment_method_selected` | User selects payment method in the modal |
| 5 | `booking_submit_success` | Booking submitted successfully |

The UI flow is: age selector → date selector → "Confirm & Pay" button →
payment modal opens → payment method → form fields → submit. The
`booking_modal_open` event fires alongside `booking_confirm_pay_click`
when the user clicks "Confirm & Pay", so it's redundant as a funnel step.

3. Set **Funnel type** to **Open** (allows users to enter at any step)
4. Add **Breakdown** dimension: `sessionSource` (to see which traffic
   sources produce the most bookings)
5. Set the date range to "Last 30 days"
6. Click the **Save** icon and name it: `Booking Funnel`

### What to look for

- **Drop-off between steps 2 and 3**: Users who select a date but don't
  click "Confirm & Pay" may be hesitant about pricing or want more
  information before committing.
- **Drop-off between steps 3 and 4**: Users who open the payment modal
  but don't select a payment method are abandoning at the reservation
  form. This is where the one known prospect dropped off (March 17).
- **Drop-off between steps 4 and 5**: Users who select payment but don't
  submit may have issues with the form, captcha, or payment instructions.

---

## 3. Payment Provider Referral Exclusion

Prevents payment provider domains from appearing as traffic sources when
users return from an external payment page.

### Current payment flow

The booking form uses **FPS QR code** and **bank transfer** — both are
offline payment methods that don't redirect to an external payment page.
Therefore, **no referral exclusion is currently needed**.

If a future payment integration (e.g., Stripe, PayMe online) redirects
users to an external domain and back, add that domain here:

1. Go to **GA4 Admin** > **Data Streams** > **Evolve Sprouts Production**
2. Click **Configure Tag Settings** > **Show all**
3. Click **List Unwanted Referrals**
4. Add the payment provider domain (e.g., `stripe.com`, `payme.hsbc.com.hk`)
5. Click **Save**

This prevents the returning session from being attributed to the payment
provider as a new referral source.

---

## 4. Custom Dimensions and Metrics

Custom event parameters must be registered in GA4 before they appear in
reports and explorations. The website pushes the following custom
parameters via `dataLayer` events (see `src/lib/analytics-taxonomy.json`):

### Custom dimensions (event-scoped)

| Parameter name   | Display name       | Purpose |
|------------------|--------------------|---------|
| `section_id`     | Section ID         | UI section where the event fired (e.g. `consultations-booking`, `my-best-auntie-booking`, `events-booking`). **Primary discriminator** for telling booking flows apart. |
| `cta_location`   | CTA Location       | Specific CTA trigger within the section. |
| `page_locale`    | Page Locale        | Locale of the page at event time (e.g. `en`, `zh-HK`). |
| `environment`    | Environment        | `prod` or `staging`. |
| `form_type`      | Form Type          | Contact or signup form variant. |
| `error_type`     | Error Type         | Error classification for failed submissions. |
| `resource_key`   | Resource Key       | Identifier for the downloadable media guide. |
| `age_group`      | Age Group          | Selected age group for booking events. |
| `cohort_label`   | Cohort Label       | Selected cohort / date label for bookings. |
| `cohort_date`    | Cohort Date        | Cohort start date (YYYY-MM-DD). |
| `is_fully_booked`| Is Fully Booked    | Whether the selected cohort is fully booked. |
| `payment_method` | Payment Method     | Selected payment method (fps_qr, bank_transfer, etc.). |
| `discount_type`  | Discount Type      | Type of discount applied. |
| `landing_page_slug` | Landing Page Slug | URL slug of the landing page. |
| `content_name`   | Content Name       | Name of the content item clicked (links hub). |

### Custom metrics (event-scoped)

| Parameter name   | Display name       | Unit     |
|------------------|--------------------|----------|
| `total_amount`   | Total Amount       | Currency |
| `discount_amount`| Discount Amount    | Standard |

### Automated registration

Run the Admin API script to register all dimensions and metrics:

```bash
python3 marketing/scripts/ga4-create-custom-dimensions.py
```

The script reads `analytics-taxonomy.json`, skips GA4 auto-collected
parameters (`page_path`, `page_title`), and creates any missing custom
dimensions/metrics. It is idempotent (safe to re-run).

Requires `EVOLVESPROUTS_GA4_PROPERTY_ID` and
`EVOLVESPROUTS_GOOGLE_SERVICE_ACCOUNT_JSON` environment variables and
temporary Editor access on the GA4 property.

### Distinguishing booking flows in GA4

The `section_id` dimension is the key differentiator for all booking
events (`booking_modal_open`, `booking_submit_success`,
`booking_thank_you_view`, etc.):

| Booking flow     | `section_id` value        |
|------------------|---------------------------|
| Consultations    | `consultations-booking`   |
| My Best Auntie   | `my-best-auntie-booking`  |
| Events           | `events-booking`          |
| Landing pages    | varies per page slug      |

Use `section_id` as a breakdown dimension in funnel explorations and
standard reports to see consultations vs MBA vs events conversions.

---

## 5. GTM eCommerce Tags (for new eCommerce events)

The codebase now pushes GA4 eCommerce events (`begin_checkout`,
`add_payment_info`, `purchase`) to the dataLayer. GTM needs corresponding
tags to forward these to GA4.

### Option A: Use the existing GA4 Configuration tag

If the GA4 Configuration tag (G-YJTWSCB01P) is set to "Send all events",
eCommerce events will be forwarded automatically. Check:

1. Open **GTM** > **Tags** > **GA4 - Configuration**
2. Verify it sends eCommerce data (or has "Send all" enabled)

### Option B: Create dedicated eCommerce event tags

If the GA4 tag uses explicit event triggers:

1. **Create triggers** for each eCommerce event:
   - Trigger: Custom Event = `begin_checkout`
   - Trigger: Custom Event = `add_payment_info`
   - Trigger: Custom Event = `purchase`

2. **Create GA4 Event tags** for each:
   - Tag type: Google Analytics: GA4 Event
   - Measurement ID: G-YJTWSCB01P
   - Event name: (match the trigger)
   - Check "Send Ecommerce data" in the tag configuration

3. **Publish** the GTM container
