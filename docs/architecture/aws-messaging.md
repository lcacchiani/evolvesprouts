# AWS Messaging Architecture

## Overview

Ticket submissions are processed asynchronously using SNS + SQS messaging. This provides reliable, decoupled processing with automatic retries and dead letter queue support.

Most booking, media, and expense-parser pipelines (plus the SES template manager custom resource) are defined in a **nested CloudFormation stack** (`MessagingNestedStack` in `backend/infrastructure/lib/messaging-stack.ts`) so the root `evolvesprouts` stack stays under CloudFormation’s 500-resource limit. The shared `SqsEncryptionKey` KMS key remains in the root stack and is passed into that nested stack (and reused by inbound invoice queues in the root). Eventbrite sync uses a separate nested stack (`EventbriteSyncNestedStack` in `api-stack.ts`).

### Two-phase deploy (named resources → nested stack)

CloudFormation cannot move resources with fixed physical names (`queueName`, `topicName`, `functionName`) into a nested stack in one update without name collisions. Deploy in order:

1. **Phase 1** (commit that strips those physical names from the root-stack messaging resources): the stack replaces them with auto-generated names, freeing the original names.
2. **Phase 2** (nested `Messaging` stack): recreates the pipelines with the original explicit names inside the nested stack.

Between phases, drain SQS queues and DLQs where possible; expect brief SNS topic ARN churn and possible failed media publishes during replacement.

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        ASYNC TICKET PROCESSING                              │
│                                                                             │
│  User submits ──▶ API Lambda ──▶ SNS Topic ──▶ SQS Queue ──▶ Processor     │
│   ticket               │              │              │         Lambda       │
│                        │              │              │            │         │
│                   (validates,    (fan-out)     (reliable      (stores in   │
│                   returns 202)                  delivery)      DB, sends   │
│                                                    │           email)      │
│                                                    │                       │
│                                                    ▼                       │
│                                               Dead Letter                  │
│                                                 Queue                      │
│                                            (failed messages)               │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Public website transactional confirmations (SES)

The public website contact form, booking modal (`/www/v1/legacy/*`), and media
download flow send **customer-facing** confirmation or download-link emails
through **Amazon SES templated send** (`SendTemplatedEmail`). Templates are
stored in SES and upserted at deploy time by a **CloudFormation custom
resource** (`SesTemplateManagerFunction`) so runtime Lambdas only reference
template names.

- **From address**: `CONFIRMATION_EMAIL_FROM_ADDRESS` on the relevant Lambdas,
  sourced from the stack `AuthEmailFromAddress` parameter (SES-verified
  customer-facing mailbox, for example `hello@`).
- **Internal notifications** (for example media lead alerts to the team)
  continue to use `SES_SENDER_EMAIL` / `SupportEmail` where applicable.
- **Mailchimp** remains separate: optional marketing subscribe + journey
  triggers run only when the user opts in; failures are logged and do not
  change the HTTP response for legacy bridge routes.

## Components

### SNS Topic: `evolvesprouts-booking-request-events`

- Receives ticket events from the API
- Fans out to subscribed SQS queue
- Message attributes enable filtering by `event_type`

### SQS Queue: `evolvesprouts-booking-request-queue`

- Subscribes to SNS topic
- 60 second visibility timeout (6x Lambda timeout)
- 3 retry attempts before DLQ
- KMS encryption with a customer-managed key (`SqsEncryptionKey`)

### Dead Letter Queue: `evolvesprouts-booking-request-dlq`

- Receives messages that fail processing 3 times
- 14 day retention for debugging
- CloudWatch alarm triggers when messages arrive

### Processor Lambda: `BookingRequestProcessor`

- Triggered by SQS messages
- Routes each message to the appropriate handler based on `event_type`
- Stores the ticket in the `tickets` table
- Sends email notification via SES
- Idempotent via `ticket_id` check

## Message Format

Each SNS message includes an `event_type` field that determines how the
processor handles it. The `ticket_id` field provides idempotency.

Example:

```json
{
  "event_type": "<type>.submitted",
  "ticket_id": "X00001",
  "...": "type-specific fields"
}
```

Current event types:
- `booking_request.submitted`
- `organization_suggestion.submitted`
- `media_request.submitted`
- `expense.parse_requested`
- `eventbrite.instance_sync_requested`

## Eventbrite sync flow

Event service instances use a dedicated SNS/SQS pipeline so admin edits can
return quickly while Eventbrite synchronization runs asynchronously with retry
and DLQ support.

### SNS Topic: `evolvesprouts-eventbrite-sync-events`

- Receives sync events from admin service-instance create/update/delete flows.
- Fans out to subscribed SQS queue.

### SQS Queue: `evolvesprouts-eventbrite-sync-queue`

- Subscribes to Eventbrite sync SNS topic.
- 120 second visibility timeout.
- 3 retry attempts before DLQ.
- KMS encryption using the shared queue key.

### Dead Letter Queue: `evolvesprouts-eventbrite-sync-dlq`

- Receives Eventbrite sync messages that fail processing 3 times.
- 14 day retention for investigation.
- CloudWatch alarm triggers when messages appear.

### Lambda dead letter queue: `evolvesprouts-eventbrite-sync-processor-lambda-dlq`

- Holds payloads for **Lambda invocation failures** (for example unhandled exceptions
  surfaced as failed async invokes) for `EventbriteSyncProcessor`.
- Distinct from `evolvesprouts-eventbrite-sync-dlq`, which is the **SQS redrive**
  target after repeated receive/delete cycles on the main queue.
- 14 day retention; KMS encryption uses the same shared queue key as other Eventbrite
  sync queues.

### Processor Lambda: `EventbriteSyncProcessor`

- Triggered by `evolvesprouts-eventbrite-sync-queue`.
- Loads event instances from DB and computes an idempotency payload hash.
- Upserts Eventbrite event and ticket classes through `AwsApiProxyFunction`.
- Updates `service_instances` Eventbrite sync metadata fields
  (`eventbrite_sync_status`, `eventbrite_last_*`, ticket-class map, retry count).

## Media messaging flow

Media leads use a dedicated SNS/SQS pipeline to keep website submissions
responsive while decoupling downstream processing.

### SNS Topic: `evolvesprouts-media-events`

- Receives media lead events from `POST /v1/assets/free/request`.
- Fans out to subscribed SQS queue.

### SQS Queue: `evolvesprouts-media-queue`

- Subscribes to media SNS topic.
- 60 second visibility timeout.
- 3 retry attempts before DLQ.
- KMS encryption using the shared queue key.

### Dead Letter Queue: `evolvesprouts-media-dlq`

- Receives media messages that fail processing 3 times.
- 14 day retention for investigation.
- CloudWatch alarm triggers when messages appear.

### Processor Lambda: `MediaRequestProcessor`

- Triggered by `evolvesprouts-media-queue`.
- Upserts contact and inserts idempotent lead rows.
- Resolves media asset IDs by matching `resource_key` against `assets.resource_key`.
- Applies a resource-specific tag (`public-www-media-<resource_key>`) to the contact.
- Sends the **download link** to the submitter via **SES templated email**
  (`evolvesprouts-media-download-{locale}`) using `CONFIRMATION_EMAIL_FROM_ADDRESS`.
- Syncs subscriber/tag to Mailchimp through `AwsApiProxyFunction` (during a
  **transition** period this may still run for all submissions; when
  `MailchimpRequireMarketingConsent` is `true`, subscribe + free-resource journey
  run only when `marketing_opt_in` is true). When users opt in, a **separate**
  shared welcome journey may be triggered (empty journey env vars disable it).
- Sends an SES notification to sales/support (internal sender).

## Expense parsing flow

Expense invoice parsing uses a dedicated SNS/SQS pipeline to avoid blocking
admin API requests while files are parsed by OpenRouter.

### SNS Topic: `evolvesprouts-expense-parser-events`

- Receives parse events from admin expense APIs (`create`, `reparse`, `amend`).
- Fans out to subscribed SQS queue.

### SQS Queue: `evolvesprouts-expense-parser-queue`

- Subscribes to expense parser SNS topic.
- 180 second visibility timeout.
- 3 retry attempts before DLQ.
- KMS encryption using the shared queue key.

### Dead Letter Queue: `evolvesprouts-expense-parser-dlq`

- Receives expense parser messages that fail processing 3 times.
- 14 day retention for investigation.
- CloudWatch alarm triggers when messages appear.

### Processor Lambda: `ExpenseParserFunction`

- Triggered by `evolvesprouts-expense-parser-queue`.
- Loads attachment metadata from `expense_attachments` + `assets`.
- Fetches file bytes from S3 and calls OpenRouter via `AwsApiProxyFunction`.
- Updates `expenses` parse status and extracted fields.

## Inbound invoice email flow

Inbound invoice emails use SES receipt rules plus the existing expense parser
topic so machine-only mailbox traffic can land directly in the expenses domain.

### Receiving address

- Public-facing mailbox stays `invoices@evolvesprouts.com` in iCloud Mail.
- iCloud forwards invoice mail to the SES-managed address on
  `inbound.evolvesprouts.com`.
- SES receipt rules match the inbound recipient and store the raw `.eml` in
  `AssetsBucket` under a reserved prefix.

### Raw email storage: `AssetsBucket` prefix `inbound-email/raw/`

- Stores the original raw email payload for replay/debugging inside the existing
  private assets bucket.
- Uses a reserved prefix so raw `.eml` objects stay separated from normal asset
  objects while still reusing the existing private bucket controls.

### SNS Topic: `evolvesprouts-inbound-invoice-email-events`

- Receives SES S3-action notifications for matching inbound emails.
- Fans out to the subscribed SQS queue.

### SQS Queue: `evolvesprouts-inbound-invoice-email-queue`

- Subscribes to the inbound invoice SNS topic.
- 60 second visibility timeout.
- 3 retry attempts before DLQ.
- KMS encryption using the shared queue key.

### Dead Letter Queue: `evolvesprouts-inbound-invoice-email-dlq`

- Receives inbound invoice messages that fail processing 3 times.
- 14 day retention for investigation.
- CloudWatch alarm triggers when messages appear.

### Processor Lambda: `InboundInvoiceEmailProcessor`

- Triggered by `evolvesprouts-inbound-invoice-email-queue`.
- Loads the raw email object from the inbound-email S3 bucket.
- Parses MIME headers and extracts supported invoice attachments, or—when
  there are no supported attachments—extracts visible text from the email body
  (`text/plain` preferred, otherwise stripped `text/html`) and stores it as a
  synthetic `text/plain` asset for parsing.
- When `INBOUND_INVOICE_ALLOWED_SENDER_PATTERNS` is set (non-empty), rejects
  messages whose SES envelope `source` and RFC822 `From` both miss every
  comma-separated substring (case-insensitive); those rows are recorded as
  failed in `inbound_emails` without creating expenses.
- Creates `assets`, `expenses`, and `expense_attachments` rows.
- Tracks idempotency in the `inbound_emails` table using SES `messageId`.
- Reuses the existing `expense.parse_requested` topic after the expense row
  is created so `ExpenseParserFunction` performs the OpenRouter extraction.

## API Behavior

User-facing submission endpoints are under `/v1/user/`. Admin review
endpoints are at `/v1/admin/tickets`. For full endpoint details
(parameters, request/response schemas), see the OpenAPI spec:
[`docs/api/admin.yaml`](../api/admin.yaml).

**Processing flow:**
1. User POSTs a submission → API validates, generates ticket ID, publishes to SNS
2. Returns `202 Accepted` with ticket ID
3. SQS delivers message to processor Lambda
4. Processor stores in DB and sends email notification to support

## Error Handling

| Scenario | Behavior |
|----------|----------|
| SNS publish fails | API returns 500, user can retry |
| Processor fails | SQS retries up to 3 times |
| All retries fail | Message moves to DLQ, alarm triggers |
| Email send fails | Logged but doesn't fail processing |

## Idempotency

The processor checks if a ticket with the same `ticket_id` already exists before inserting. This handles SQS's at-least-once delivery guarantee.

Inbound invoice processing uses the SES `mail.messageId` value stored in
`inbound_emails.ses_message_id` to prevent duplicate expense creation across
SQS retries or mailbox forwarding duplicates.

## Files

| File | Description |
|------|-------------|
| `backend/infrastructure/lib/api-stack.ts` | CDK infrastructure |
| `backend/src/app/api/admin.py` | API handler with SNS publish and public calendar feed routing |
| `backend/lambda/manager_request_processor/handler.py` | SQS booking request processor |
| `backend/lambda/media_processor/handler.py` | SQS media request processor |
| `backend/lambda/ses_template_manager/handler.py` | CloudFormation custom resource — upsert SES email templates |
| `backend/lambda/inbound_invoice_email/handler.py` | SQS inbound invoice email processor |
| `backend/src/app/services/inbound_invoice_ingest.py` | Expense + asset creation from inbound email |
| `backend/src/app/db/repositories/ticket.py` | Repository with `find_by_ticket_id` |

## Environment Variables

### API Lambda

| Variable | Description |
|----------|-------------|
| `BOOKING_REQUEST_TOPIC_ARN` | SNS topic ARN (required) |
| `MEDIA_REQUEST_TOPIC_ARN` | SNS topic ARN for media events (required) |
| `EXPENSE_PARSE_TOPIC_ARN` | SNS topic ARN for expense parser events (required) |
| `EVENTBRITE_SYNC_TOPIC_ARN` | SNS topic ARN for Eventbrite sync events (required for Eventbrite DB-sync) |
| `CONFIRMATION_EMAIL_FROM_ADDRESS` | SES-verified from address for customer-facing templated emails on legacy public routes (`EvolvesproutsAdminFunction`) |
| `PUBLIC_WWW_BASE_URL` | HTTPS origin of the public website (Contact Us FAQ anchor in contact confirmation templates: `/{locale}/contact-us#contact-us-faq`) |
| `MAILCHIMP_API_SECRET_ARN` | Mailchimp API key secret (marketing subscribe after opt-in on legacy routes) |
| `MAILCHIMP_LIST_ID` | Mailchimp audience ID |
| `MAILCHIMP_SERVER_PREFIX` | Mailchimp API host prefix |
| `MAILCHIMP_WELCOME_JOURNEY_ID` | Optional shared welcome journey ID (empty disables) |
| `MAILCHIMP_WELCOME_JOURNEY_STEP_ID` | Optional welcome journey entry step ID (empty disables) |

### Processor Lambda

| Variable | Description |
|----------|-------------|
| `DATABASE_SECRET_ARN` | Database credentials secret |
| `DATABASE_PROXY_ENDPOINT` | RDS Proxy endpoint |
| `SUPPORT_EMAIL` | Email to receive notifications |
| `SES_SENDER_EMAIL` | Verified SES sender address |
| `SES_TEMPLATE_NEW_ACCESS_REQUEST` | Optional SES template for access requests |
| `SES_TEMPLATE_NEW_SUGGESTION` | Optional SES template for suggestions |
| `MAILCHIMP_API_SECRET_ARN` | Existing secret ARN for Mailchimp API key |
| `MAILCHIMP_LIST_ID` | Mailchimp list ID |
| `MAILCHIMP_SERVER_PREFIX` | Mailchimp server prefix (for example `us21`) |
| `MEDIA_DEFAULT_RESOURCE_KEY` | Default resource key used when request payload omits `resource_key` |
| `ASSET_SHARE_LINK_BASE_URL` | HTTPS base for Mailchimp download URLs at `/v1/assets/email-download/{token}` (media processor; asset download domain) |
| `ASSET_SHARE_LINK_DEFAULT_ALLOWED_DOMAINS` | Comma-separated Referer/Origin hostnames allowed for new share links (media processor; same value as admin) |
| `MAILCHIMP_MEDIA_DOWNLOAD_MERGE_TAG` | Mailchimp merge field tag for that email-download URL (e.g. `MMDLURL`; empty disables) |
| `MAILCHIMP_FREE_RESOURCE_JOURNEY_ID` | Mailchimp Customer Journey ID for `.../journeys/{id}/steps/.../actions/trigger` (empty disables) |
| `MAILCHIMP_FREE_RESOURCE_JOURNEY_STEP_ID` | Journey step ID paired with `MAILCHIMP_FREE_RESOURCE_JOURNEY_ID` (empty disables) |
| `CONFIRMATION_EMAIL_FROM_ADDRESS` | SES-verified from address for media download link email to the submitter |
| `MAILCHIMP_REQUIRE_MARKETING_CONSENT` | When `true`, gate legacy Mailchimp subscribe + free-resource journey on `marketing_opt_in` |
| `MAILCHIMP_WELCOME_JOURNEY_ID` | Optional shared welcome journey ID for opted-in media leads (empty disables) |
| `MAILCHIMP_WELCOME_JOURNEY_STEP_ID` | Optional welcome journey entry step ID (empty disables) |
| `PUBLIC_WWW_BASE_URL` | HTTPS origin of the public website (reserved for template helpers) |
| `AWS_PROXY_FUNCTION_ARN` | Lambda ARN for HTTP proxy calls |
| `OPENROUTER_API_KEY_SECRET_ARN` | Existing secret ARN for OpenRouter API key |
| `OPENROUTER_CHAT_COMPLETIONS_URL` | OpenRouter chat completion URL |
| `OPENROUTER_MODEL` | OpenRouter model identifier |
| `OPENROUTER_MAX_FILE_BYTES` | Attachment size limit for parser |
| `ASSETS_BUCKET_NAME` | Existing private assets bucket for expense attachments |
| `EXPENSE_PARSE_TOPIC_ARN` | SNS topic ARN for expense parser events |
| `EVENTBRITE_API_BASE_URL` | Eventbrite API base URL for sync processor |
| `EVENTBRITE_ORGANIZATION_ID` | Eventbrite organization ID used for event upserts |
| `EVENTBRITE_TOKEN_SECRET_ARN` | Secrets Manager ARN for Eventbrite API token JSON |

## Stack Outputs

| Output | Description |
|--------|-------------|
| `BookingRequestTopicArn` | SNS topic ARN |
| `BookingRequestQueueUrl` | SQS queue URL |
| `BookingRequestDLQUrl` | Dead letter queue URL |
| `MediaTopicArn` | SNS topic ARN for media events |
| `MediaQueueUrl` | SQS queue URL for media processing |
| `MediaDLQUrl` | Dead letter queue URL for failed media requests |
| `ExpenseParserTopicArn` | SNS topic ARN for expense parser events |
| `ExpenseParserQueueUrl` | SQS queue URL for expense parser processing |
| `ExpenseParserDLQUrl` | Dead letter queue URL for failed expense parser jobs |
| `EventbriteSyncTopicArn` | SNS topic ARN for Eventbrite sync events |
| `EventbriteSyncQueueUrl` | SQS queue URL for Eventbrite sync processing |
| `EventbriteSyncDLQUrl` | Dead letter queue URL for failed Eventbrite sync jobs (SQS redrive) |
| `EventbriteSyncProcessorLambdaDLQUrl` | Dead letter queue URL for failed EventbriteSyncProcessor Lambda invocations |
| `InboundInvoiceRecipientAddress` | SES-managed recipient address for invoice automation |
| `InboundInvoiceRawEmailPrefix` | Reserved object-key prefix for raw inbound invoice emails |
| `InboundInvoiceTopicArn` | SNS topic ARN for inbound invoice email events |
| `InboundInvoiceQueueUrl` | SQS queue URL for inbound invoice email processing |
| `InboundInvoiceDLQUrl` | Dead letter queue URL for failed inbound invoice emails |
| `InboundInvoiceMxTarget` | MX target for the SES inbound subdomain |

## Monitoring

- **DLQ Alarm**: Triggers when messages land in DLQ
- **CloudWatch Logs**: Both API and processor Lambda log to CloudWatch
- **X-Ray**: Tracing enabled for request flow visibility
