"""Mailchimp Marketing API integration via AWS proxy."""

from __future__ import annotations

import base64
import hashlib
import json
import os
from typing import Any, Iterator
from urllib.parse import urlencode

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


def _mailchimp_base_url_and_auth() -> tuple[str, str]:
    """Return (base_url, Authorization header value) for Mailchimp API calls."""
    api_key = _get_api_key()
    server_prefix = os.getenv("MAILCHIMP_SERVER_PREFIX", "").strip()
    if not server_prefix:
        raise RuntimeError("MAILCHIMP_SERVER_PREFIX is not configured")
    base_url = f"https://{server_prefix}.api.mailchimp.com/3.0"
    auth_header = f"Basic {_encode_auth(api_key)}"
    return base_url, auth_header


def _list_id_or_raise() -> str:
    list_id = os.getenv("MAILCHIMP_LIST_ID", "").strip()
    if not list_id:
        raise RuntimeError("MAILCHIMP_LIST_ID is required")
    return list_id


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


class MailchimpApiError(Exception):
    """Raised when Mailchimp API returns a non-success status."""

    def __init__(self, status: int, body: str):
        self.status = status
        self.body = body
        super().__init__(f"Mailchimp API error {status}: {body}")


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
    normalized_email = email.strip().lower()
    if not normalized_email:
        raise ValueError("email is required")
    normalized_first_name = " ".join(first_name.split()).strip()
    if not normalized_first_name:
        raise ValueError("first_name is required")
    normalized_tag_name = " ".join(tag_name.split()).strip()
    if not normalized_tag_name:
        raise ValueError("tag_name is required")

    list_id = _list_id_or_raise()
    subscriber_hash = _subscriber_hash(normalized_email)
    base_url, auth_header = _mailchimp_base_url_and_auth()

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


def archive_subscriber(*, email: str) -> bool:
    """Archive a list member (soft-delete). 204 and 404 both return True."""
    normalized_email = email.strip().lower()
    if not normalized_email:
        raise ValueError("email is required")
    list_id = _list_id_or_raise()
    base_url, auth_header = _mailchimp_base_url_and_auth()
    subscriber_hash = _subscriber_hash(normalized_email)
    member_url = f"{base_url}/lists/{list_id}/members/{subscriber_hash}"
    response = http_invoke(
        method="DELETE",
        url=member_url,
        headers={
            "Authorization": auth_header,
            "Content-Type": "application/json",
        },
        timeout=10,
    )
    status = _status_code(response)
    body = _response_body(response)
    if status == 204 or status == 404:
        if status == 404:
            logger.info(
                "Mailchimp archive skipped (member not found)",
                extra={"lead_email": mask_email(normalized_email)},
            )
        return True
    if status < 200 or status >= 300:
        logger.warning(
            "Mailchimp archive failed",
            extra={
                "status": status,
                "lead_email": mask_email(normalized_email),
                "mailchimp_step": "archive_member",
                "mailchimp_error_body": _error_body_for_log(body),
            },
        )
        raise MailchimpApiError(status, body)
    return True


def permanent_delete_subscriber(*, email: str) -> bool:
    """Permanently erase a list member (GDPR). 204 and 404 both return True."""
    normalized_email = email.strip().lower()
    if not normalized_email:
        raise ValueError("email is required")
    list_id = _list_id_or_raise()
    base_url, auth_header = _mailchimp_base_url_and_auth()
    subscriber_hash = _subscriber_hash(normalized_email)
    action_url = (
        f"{base_url}/lists/{list_id}/members/{subscriber_hash}/actions/delete-permanent"
    )
    response = http_invoke(
        method="POST",
        url=action_url,
        headers={
            "Authorization": auth_header,
            "Content-Type": "application/json",
        },
        body="{}",
        timeout=10,
    )
    status = _status_code(response)
    body = _response_body(response)
    if status == 204 or status == 404:
        if status == 404:
            logger.info(
                "Mailchimp permanent delete skipped (member not found)",
                extra={"lead_email": mask_email(normalized_email)},
            )
        return True
    if status < 200 or status >= 300:
        logger.warning(
            "Mailchimp permanent delete failed",
            extra={
                "status": status,
                "lead_email": mask_email(normalized_email),
                "mailchimp_step": "delete_member_permanent",
                "mailchimp_error_body": _error_body_for_log(body),
            },
        )
        raise MailchimpApiError(status, body)
    return True


def iter_audience_members(
    *,
    page_size: int = 200,
    fields: tuple[str, ...] = (
        "members.id",
        "members.email_address",
        "members.status",
        "members.unique_email_id",
        "total_items",
    ),
    start_offset: int = 0,
    single_page: bool = False,
) -> Iterator[dict[str, Any]]:
    """Yield list members from the configured audience.

    When ``single_page`` is True, only the first HTTP response (at ``start_offset``)
    is fetched; otherwise all pages are walked until a short page.
    """
    if page_size < 1 or page_size > 1000:
        raise ValueError("page_size must be between 1 and 1000")
    list_id = _list_id_or_raise()
    base_url, auth_header = _mailchimp_base_url_and_auth()
    offset = max(0, start_offset)
    while True:
        query = urlencode(
            {
                "count": page_size,
                "offset": offset,
                "fields": ",".join(fields),
            }
        )
        list_url = f"{base_url}/lists/{list_id}/members?{query}"
        response = http_invoke(
            method="GET",
            url=list_url,
            headers={
                "Authorization": auth_header,
                "Content-Type": "application/json",
            },
            timeout=15,
        )
        status = _status_code(response)
        body = _response_body(response)
        if status < 200 or status >= 300:
            logger.warning(
                "Mailchimp list members fetch failed",
                extra={
                    "status": status,
                    "mailchimp_step": "list_members",
                    "mailchimp_error_body": _error_body_for_log(body),
                },
            )
            raise MailchimpApiError(status, body)
        payload = _parse_json(body)
        members = payload.get("members")
        if not isinstance(members, list):
            members = []
        for member in members:
            if isinstance(member, dict):
                yield member
        if single_page or len(members) < page_size:
            break
        offset += len(members)
