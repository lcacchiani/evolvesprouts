# AWS Messaging Architecture

## Overview

Ticket submissions are processed asynchronously using SNS + SQS messaging. This provides reliable, decoupled processing with automatic retries and dead letter queue support.

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

## Media messaging flow

Media leads use a dedicated SNS/SQS pipeline to keep website submissions
responsive while decoupling downstream processing.

### SNS Topic: `evolvesprouts-free-guide-events`

- Receives media lead events from `POST /v1/media-request`.
- Fans out to subscribed SQS queue.

### SQS Queue: `evolvesprouts-free-guide-queue`

- Subscribes to free-guide SNS topic.
- 60 second visibility timeout.
- 3 retry attempts before DLQ.
- KMS encryption using the shared queue key.

### Dead Letter Queue: `evolvesprouts-free-guide-dlq`

- Receives free-guide messages that fail processing 3 times.
- 14 day retention for investigation.
- CloudWatch alarm triggers when messages appear.

### Processor Lambda: `FreeGuideRequestProcessor`

- Triggered by `evolvesprouts-free-guide-queue`.
- Upserts contact and inserts idempotent lead rows.
- Applies the configured free-guide tag to the contact.
- Syncs subscriber/tag to Mailchimp through `AwsApiProxyFunction`.
- Sends an SES notification to sales/support.

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

## Files

| File | Description |
|------|-------------|
| `backend/infrastructure/lib/api-stack.ts` | CDK infrastructure |
| `backend/src/app/api/admin.py` | API handler with SNS publish |
| `backend/lambda/manager_request_processor/handler.py` | SQS booking request processor |
| `backend/lambda/free_guide_processor/handler.py` | SQS media request processor |
| `backend/src/app/db/repositories/ticket.py` | Repository with `find_by_ticket_id` |

## Environment Variables

### API Lambda

| Variable | Description |
|----------|-------------|
| `BOOKING_REQUEST_TOPIC_ARN` | SNS topic ARN (required) |
| `MEDIA_REQUEST_TOPIC_ARN` | SNS topic ARN for media events (required) |

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
| `FREE_GUIDE_TAG` | Mailchimp/CRM tag to apply |
| `FOUR_WAYS_PATIENCE_FREE_GUIDE_ASSET_ID` | Asset UUID for free-guide lead dedupe |
| `AWS_PROXY_FUNCTION_ARN` | Lambda ARN for HTTP proxy calls |

## Stack Outputs

| Output | Description |
|--------|-------------|
| `BookingRequestTopicArn` | SNS topic ARN |
| `BookingRequestQueueUrl` | SQS queue URL |
| `BookingRequestDLQUrl` | Dead letter queue URL |
| `FreeGuideTopicArn` | SNS topic ARN for free-guide events |
| `FreeGuideQueueUrl` | SQS queue URL for free-guide processing |
| `FreeGuideDLQUrl` | Dead letter queue URL for failed free-guide requests |

## Monitoring

- **DLQ Alarm**: Triggers when messages land in DLQ
- **CloudWatch Logs**: Both API and processor Lambda log to CloudWatch
- **X-Ray**: Tracing enabled for request flow visibility
