"""Mailchimp Marketing API integration via AWS proxy."""

from __future__ import annotations

import base64
import hashlib
import json
from typing import Any

from app.services.aws_clients import get_secretsmanager_client
from app.services.aws_proxy import http_invoke
from app.utils.logging import get_logger, mask_email

logger = get_logger(__name__)

_api_key_cache: str | None = None
# Cap error body length in logs (Mailchimp JSON is small; proxy errors may not be).
_MAILCHIMP_ERROR_BODY_LOG_LIMIT = 2048


def _error_body_for_log(body: str) -> str:
    """Trim and truncate Mailchimp (or proxy) error bodies for structured logs."""
    normalized = body.strip().replace("\r\n", "\n")
    if len(normalized) <= _MAILCHIMP_ERROR_BODY_LOG_LIMIT:
        return normalized
    return f"{normalized[:_MAILCHIMP_ERROR_BODY_LOG_LIMIT]}...(truncated)"


def _get_api_key() -> str:
    """Retrieve Mailchimp API key from Secrets Manager with module cache."""
    global _api_key_cache
    if _api_key_cache is not None:
        return _api_key_cache

    import os

    secret_arn = os.getenv("MAILCHIMP_API_SECRET_ARN", "").strip()
    if not secret_arn:
        raise RuntimeError("MAILCHIMP_API_SECRET_ARN is not configured")

    response = get_secretsmanager_client().get_secret_value(SecretId=secret_arn)
    secret_string = response.get("SecretString")
    if not secret_string and response.get("SecretBinary"):
        import base64 as _base64

        secret_string = _base64.b64decode(response["SecretBinary"]).decode("utf-8")
    if not secret_string:
        raise RuntimeError("Mailchimp API secret is empty")

    _api_key_cache = _extract_api_key(secret_string)
    return _api_key_cache


def _extract_api_key(secret_string: str) -> str:
    raw = secret_string.strip()
    if not raw:
        raise RuntimeError("Mailchimp API secret value is blank")

    if raw.startswith("{"):
        parsed_secret = json.loads(raw)
        if not isinstance(parsed_secret, dict):
            raise RuntimeError("Mailchimp API secret JSON must be an object")
        for key_name in ("api_key", "MAILCHIMP_API_KEY", "key", "token"):
            candidate = parsed_secret.get(key_name)
            if isinstance(candidate, str) and candidate.strip():
                return candidate.strip()
        raise RuntimeError("Mailchimp API key field is missing in secret JSON")

    return raw


def _subscriber_hash(email: str) -> str:
    """MD5 hash of lowercase email required by Mailchimp member endpoints."""
    normalized_email = email.strip().lower().encode()
    return hashlib.md5(normalized_email, usedforsecurity=False).hexdigest()  # noqa: S324


def _encode_auth(api_key: str) -> str:
    return base64.b64encode(f"anystring:{api_key}".encode()).decode()


def _status_code(response: dict[str, Any]) -> int:
    try:
        return int(response.get("status", 0))
    except (TypeError, ValueError):
        return 0


def _response_body(response: dict[str, Any]) -> str:
    return str(response.get("body", "") or "")


def _parse_json(body: str) -> dict[str, Any]:
    if not body:
        return {}
    try:
        parsed = json.loads(body)
    except json.JSONDecodeError:
        return {}
    return parsed if isinstance(parsed, dict) else {}


def add_subscriber_with_tag(
    *,
    email: str,
    first_name: str,
    tag_name: str,
    merge_fields: dict[str, str] | None = None,
) -> dict[str, Any]:
    """Add or update a Mailchimp subscriber and apply a tag.

    Optional ``merge_fields`` are merged into the member payload (Mailchimp merge
    field tags, e.g. FNAME, MMDLURL). Empty values are skipped.
    """
    import os

    normalized_email = email.strip().lower()
    if not normalized_email:
        raise ValueError("email is required")
    normalized_first_name = " ".join(first_name.split()).strip()
    if not normalized_first_name:
        raise ValueError("first_name is required")
    normalized_tag_name = " ".join(tag_name.split()).strip()
    if not normalized_tag_name:
        raise ValueError("tag_name is required")

    api_key = _get_api_key()
    list_id = os.getenv("MAILCHIMP_LIST_ID", "").strip()
    server_prefix = os.getenv("MAILCHIMP_SERVER_PREFIX", "").strip()
    if not list_id or not server_prefix:
        raise RuntimeError("MAILCHIMP_LIST_ID and MAILCHIMP_SERVER_PREFIX are required")

    subscriber_hash = _subscriber_hash(normalized_email)
    base_url = f"https://{server_prefix}.api.mailchimp.com/3.0"
    auth_header = f"Basic {_encode_auth(api_key)}"

    merge_payload: dict[str, str] = {"FNAME": normalized_first_name}
    if merge_fields:
        for raw_key, raw_val in merge_fields.items():
            key = str(raw_key).strip()
            val = str(raw_val).strip()
            if key and val:
                merge_payload[key] = val

    member_url = f"{base_url}/lists/{list_id}/members/{subscriber_hash}"
    member_response = http_invoke(
        method="PUT",
        url=member_url,
        headers={
            "Authorization": auth_header,
            "Content-Type": "application/json",
        },
        body=json.dumps(
            {
                "email_address": normalized_email,
                "status_if_new": "subscribed",
                "merge_fields": merge_payload,
            }
        ),
        timeout=15,
    )
    member_status = _status_code(member_response)
    member_body = _response_body(member_response)
    if member_status < 200 or member_status >= 300:
        logger.warning(
            "Mailchimp upsert failed",
            extra={
                "status": member_status,
                "lead_email": mask_email(normalized_email),
                "mailchimp_step": "upsert_member",
                "mailchimp_error_body": _error_body_for_log(member_body),
            },
        )
        raise MailchimpApiError(member_status, member_body)

    tags_url = f"{base_url}/lists/{list_id}/members/{subscriber_hash}/tags"
    tags_response = http_invoke(
        method="POST",
        url=tags_url,
        headers={
            "Authorization": auth_header,
            "Content-Type": "application/json",
        },
        body=json.dumps({"tags": [{"name": normalized_tag_name, "status": "active"}]}),
        timeout=10,
    )
    tags_status = _status_code(tags_response)
    tags_body = _response_body(tags_response)
    if tags_status < 200 or tags_status >= 300:
        logger.warning(
            "Mailchimp tag apply failed",
            extra={
                "status": tags_status,
                "lead_email": mask_email(normalized_email),
                "mailchimp_step": "apply_tags",
                "mailchimp_error_body": _error_body_for_log(tags_body),
            },
        )
        raise MailchimpApiError(tags_status, tags_body)

    return _parse_json(member_body)


def trigger_customer_journey(
    *,
    email: str,
    journey_id: str,
    step_id: str,
) -> None:
    """POST Mailchimp Customer Journey API to add a contact to a journey step.

    Requires ``MAILCHIMP_SERVER_PREFIX``. Raises ``MailchimpApiError`` on non-2xx.
    """
    import os

    normalized_email = email.strip().lower()
    if not normalized_email:
        raise ValueError("email is required")
    jid = journey_id.strip()
    sid = step_id.strip()
    if not jid or not sid:
        raise ValueError("journey_id and step_id are required")

    server_prefix = os.getenv("MAILCHIMP_SERVER_PREFIX", "").strip()
    if not server_prefix:
        raise RuntimeError("MAILCHIMP_SERVER_PREFIX is not configured")

    api_key = _get_api_key()
    base_url = f"https://{server_prefix}.api.mailchimp.com/3.0"
    auth_header = f"Basic {_encode_auth(api_key)}"
    trigger_url = (
        f"{base_url}/customer-journeys/journeys/{jid}/steps/{sid}/actions/trigger"
    )
    response = http_invoke(
        method="POST",
        url=trigger_url,
        headers={
            "Authorization": auth_header,
            "Content-Type": "application/json",
        },
        body=json.dumps({"email_address": normalized_email}),
        timeout=15,
    )
    status = _status_code(response)
    body = _response_body(response)
    if status < 200 or status >= 300:
        logger.warning(
            "Mailchimp journey trigger failed",
            extra={
                "status": status,
                "lead_email": mask_email(normalized_email),
                "mailchimp_step": "trigger_journey",
                "mailchimp_error_body": _error_body_for_log(body),
            },
        )
        raise MailchimpApiError(status, body)


class MailchimpApiError(Exception):
    """Raised when Mailchimp API returns a non-success status."""

    def __init__(self, status: int, body: str):
        self.status = status
        self.body = body
        super().__init__(f"Mailchimp API error {status}: {body}")
