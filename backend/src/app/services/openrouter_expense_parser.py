"""OpenRouter invoice parser integration via AWS proxy."""

from __future__ import annotations

import base64
import json
import os
from typing import Any
from collections.abc import Mapping, Sequence

from app.services.aws_clients import get_s3_client, get_secretsmanager_client
from app.services.aws_proxy import http_invoke

_api_key_cache: str | None = None


def parse_invoice_from_assets(assets: Sequence[Mapping[str, Any]]) -> dict[str, Any]:
    """Parse invoice details from expense attachment assets."""
    if not assets:
        raise ValueError("At least one asset is required for parsing")

    endpoint_url = _require_env("OPENROUTER_CHAT_COMPLETIONS_URL")
    model = _require_env("OPENROUTER_MODEL")
    api_key = _get_api_key()

    content: list[dict[str, Any]] = [{"type": "text", "text": _schema_prompt()}]
    for asset in assets:
        content.append(_build_attachment_content(asset))

    response = http_invoke(
        method="POST",
        url=endpoint_url,
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        },
        body=json.dumps(
            {
                "model": model,
                "temperature": 0,
                "messages": [
                    {
                        "role": "system",
                        "content": "You extract invoice data and return strict JSON only.",
                    },
                    {"role": "user", "content": content},
                ],
            }
        ),
        timeout=30,
    )

    status_code = int(response.get("status", 0) or 0)
    body = str(response.get("body", "") or "")
    if status_code < 200 or status_code >= 300:
        raise RuntimeError(f"OpenRouter request failed with status {status_code}")
    parsed = _parse_completion_body(body)
    return _normalize_result(parsed)


def _build_attachment_content(asset: Mapping[str, Any]) -> dict[str, Any]:
    bucket = _require_env("CLIENT_ASSETS_BUCKET_NAME")
    max_file_bytes = _parse_max_file_bytes()

    s3_key = str(asset.get("s3_key") or "").strip()
    if not s3_key:
        raise RuntimeError("Attachment is missing s3_key")
    response = get_s3_client().get_object(Bucket=bucket, Key=s3_key)
    body = response["Body"].read()
    if len(body) > max_file_bytes:
        raise RuntimeError(f"Attachment {asset.get('id')} exceeds parser size limit")
    content_type = _normalize_content_type(asset)
    encoded = base64.b64encode(body).decode("utf-8")
    return {
        "type": "file",
        "file": {
            "filename": str(asset.get("file_name") or "attachment"),
            "file_data": f"data:{content_type};base64,{encoded}",
        },
    }


def _normalize_content_type(asset: Mapping[str, Any]) -> str:
    content_type = str(asset.get("content_type") or "").strip().lower()
    if content_type:
        return content_type
    lowered_name = str(asset.get("file_name") or "").lower()
    if lowered_name.endswith(".pdf"):
        return "application/pdf"
    if lowered_name.endswith(".png"):
        return "image/png"
    if lowered_name.endswith(".jpg") or lowered_name.endswith(".jpeg"):
        return "image/jpeg"
    if lowered_name.endswith(".webp"):
        return "image/webp"
    return "application/octet-stream"


def _parse_completion_body(body: str) -> dict[str, Any]:
    payload = json.loads(body)
    if not isinstance(payload, dict):
        raise RuntimeError("OpenRouter response must be a JSON object")
    choices = payload.get("choices")
    if not isinstance(choices, list) or not choices:
        raise RuntimeError("OpenRouter response choices are missing")
    first_choice = choices[0]
    if not isinstance(first_choice, dict):
        raise RuntimeError("OpenRouter response choice has invalid shape")
    message = first_choice.get("message")
    if not isinstance(message, dict):
        raise RuntimeError("OpenRouter response message is missing")
    content = message.get("content")
    if isinstance(content, list):
        text_parts = [
            str(item.get("text"))
            for item in content
            if isinstance(item, dict) and item.get("type") == "text"
        ]
        raw_text = "\n".join(part for part in text_parts if part)
    else:
        raw_text = str(content or "")
    cleaned = raw_text.strip().removeprefix("```json").removeprefix("```").removesuffix("```").strip()
    parsed = json.loads(cleaned)
    if not isinstance(parsed, dict):
        raise RuntimeError("Parser response payload is not an object")
    return parsed


def _normalize_result(parsed: dict[str, Any]) -> dict[str, Any]:
    line_items = parsed.get("line_items")
    normalized_line_items: list[dict[str, Any]] = []
    if isinstance(line_items, list):
        for item in line_items:
            if not isinstance(item, dict):
                continue
            normalized_line_items.append(
                {
                    "description": _optional_text(item.get("description"), max_length=500),
                    "quantity": _optional_number(item.get("quantity")),
                    "unit_price": _optional_number(item.get("unit_price")),
                    "amount": _optional_number(item.get("amount")),
                }
            )

    return {
        "vendor_name": _optional_text(parsed.get("vendor_name"), max_length=255),
        "invoice_number": _optional_text(parsed.get("invoice_number"), max_length=128),
        "invoice_date": _optional_iso_date(parsed.get("invoice_date")),
        "due_date": _optional_iso_date(parsed.get("due_date")),
        "currency": _optional_currency(parsed.get("currency")),
        "subtotal": _optional_number(parsed.get("subtotal")),
        "tax": _optional_number(parsed.get("tax")),
        "total": _optional_number(parsed.get("total")),
        "line_items": normalized_line_items,
        "confidence": _optional_number(parsed.get("confidence")),
        "raw": parsed,
    }


def _get_api_key() -> str:
    global _api_key_cache
    if _api_key_cache is not None:
        return _api_key_cache
    secret_arn = _require_env("OPENROUTER_API_KEY_SECRET_ARN")
    response = get_secretsmanager_client().get_secret_value(SecretId=secret_arn)
    secret_string = response.get("SecretString")
    if not secret_string and response.get("SecretBinary"):
        secret_string = base64.b64decode(response["SecretBinary"]).decode("utf-8")
    if not secret_string:
        raise RuntimeError("OpenRouter API key secret is empty")
    _api_key_cache = _extract_key(secret_string)
    return _api_key_cache


def _extract_key(secret_string: str) -> str:
    raw = secret_string.strip()
    if not raw:
        raise RuntimeError("OpenRouter API key value is blank")
    if raw.startswith("{"):
        payload = json.loads(raw)
        if not isinstance(payload, dict):
            raise RuntimeError("OpenRouter secret JSON must be an object")
        for key_name in (
            "openrouter_api_key",
            "OPENROUTER_API_KEY",
            "api_key",
            "key",
            "token",
        ):
            candidate = payload.get(key_name)
            if isinstance(candidate, str) and candidate.strip():
                return candidate.strip()
        raise RuntimeError("OpenRouter API key is missing in secret JSON")
    return raw


def _optional_text(value: Any, *, max_length: int) -> str | None:
    if value is None:
        return None
    normalized = str(value).strip()
    if not normalized:
        return None
    return normalized[:max_length]


def _optional_number(value: Any) -> float | None:
    if value is None:
        return None
    try:
        return float(str(value).strip())
    except (TypeError, ValueError):
        return None


def _optional_iso_date(value: Any) -> str | None:
    normalized = _optional_text(value, max_length=20)
    if normalized is None:
        return None
    try:
        from datetime import date

        parsed = date.fromisoformat(normalized)
        return parsed.isoformat()
    except ValueError:
        return None


def _optional_currency(value: Any) -> str | None:
    normalized = _optional_text(value, max_length=3)
    if normalized is None:
        return None
    return normalized.upper()


def _parse_max_file_bytes() -> int:
    raw = os.getenv("OPENROUTER_MAX_FILE_BYTES", "").strip()
    if not raw:
        return 15 * 1024 * 1024
    try:
        parsed = int(raw)
    except ValueError:
        return 15 * 1024 * 1024
    return max(1, parsed)


def _require_env(name: str) -> str:
    value = os.getenv(name, "").strip()
    if not value:
        raise RuntimeError(f"{name} is not configured")
    return value


def _schema_prompt() -> str:
    return (
        "Extract invoice data and return strict JSON only with shape: "
        '{"vendor_name": "string|null", "invoice_number": "string|null", '
        '"invoice_date": "YYYY-MM-DD|null", "due_date": "YYYY-MM-DD|null", '
        '"currency": "string|null", "subtotal": "number|null", "tax": "number|null", '
        '"total": "number|null", "line_items": [{"description":"string|null","quantity":"number|null",'
        '"unit_price":"number|null","amount":"number|null"}], "confidence":"number|null"}. '
        "Use null for unknown values. No markdown. No prose."
    )
