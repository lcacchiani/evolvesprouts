"""Non-blocking Mailchimp marketing subscribe + welcome journey trigger."""

from __future__ import annotations

import os
from logging import Logger

from app.services.mailchimp import (
    MailchimpApiError,
    add_subscriber_with_tag,
    trigger_customer_journey,
)
from app.utils.logging import ContextLogger, mask_email
from app.utils.retry import run_with_retry


def _is_retryable_mailchimp_exception(exc: Exception) -> bool:
    if isinstance(exc, MailchimpApiError):
        return exc.status == 429 or exc.status >= 500
    return isinstance(exc, (ConnectionError, TimeoutError))


def subscribe_to_marketing(
    *,
    email: str,
    first_name: str,
    tag_name: str,
    merge_fields: dict[str, str] | None = None,
    logger: Logger | ContextLogger,
) -> bool:
    """Add a contact to the Mailchimp audience with a tag and trigger the welcome journey.

    Returns True if the subscribe succeeded. Logs errors and never raises.
    """
    normalized_email = email.strip().lower()
    normalized_first = " ".join(first_name.split()).strip()
    if not normalized_email or not normalized_first:
        logger.warning(
            "Skipping marketing subscribe: missing email or first name",
            extra={"lead_email": mask_email(normalized_email)},
        )
        return False

    try:
        run_with_retry(
            add_subscriber_with_tag,
            email=normalized_email,
            first_name=normalized_first,
            tag_name=tag_name,
            merge_fields=merge_fields,
            max_attempts=3,
            base_delay_seconds=1.0,
            should_retry=_is_retryable_mailchimp_exception,
            logger=logger,
            operation_name="marketing.add_subscriber_with_tag",
        )
    except MailchimpApiError as exc:
        logger.warning(
            "Marketing subscribe failed",
            extra={
                "status": exc.status,
                "lead_email": mask_email(normalized_email),
            },
        )
        return False
    except Exception:
        logger.exception(
            "Marketing subscribe failed unexpectedly",
            extra={"lead_email": mask_email(normalized_email)},
        )
        return False

    journey_id = os.getenv("MAILCHIMP_WELCOME_JOURNEY_ID", "").strip()
    step_id = os.getenv("MAILCHIMP_WELCOME_JOURNEY_STEP_ID", "").strip()
    if not journey_id or not step_id:
        return True

    try:
        run_with_retry(
            trigger_customer_journey,
            email=normalized_email,
            journey_id=journey_id,
            step_id=step_id,
            max_attempts=3,
            base_delay_seconds=1.0,
            should_retry=_is_retryable_mailchimp_exception,
            logger=logger,
            operation_name="marketing.trigger_welcome_journey",
        )
    except MailchimpApiError as exc:
        logger.warning(
            "Welcome journey trigger failed",
            extra={
                "status": exc.status,
                "lead_email": mask_email(normalized_email),
            },
        )
    except Exception:
        logger.exception(
            "Welcome journey trigger failed unexpectedly",
            extra={"lead_email": mask_email(normalized_email)},
        )

    return True
