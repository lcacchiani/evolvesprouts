"""OpenRouter invoice parser integration via AWS proxy."""

from __future__ import annotations

import base64
import json
import math
import os
import re
from typing import Any
from collections.abc import Mapping, Sequence

from app.services.aws_clients import get_s3_client, get_secretsmanager_client
from app.services.aws_proxy import http_invoke
from app.utils.logging import get_logger

logger = get_logger(__name__)

_api_key_cache: str | None = None
_PDF_PLUGIN_ID = "file-parser"
_DEFAULT_PDF_ENGINE = "mistral-ocr"


def parse_invoice_from_assets(assets: Sequence[Mapping[str, Any]]) -> dict[str, Any]:
    """Parse invoice details from expense attachment assets."""
    if not assets:
        raise ValueError("At least one asset is required for parsing")

    logger.info("Starting invoice parse", extra={"asset_count": len(assets)})
    endpoint_url = _require_env("OPENROUTER_CHAT_COMPLETIONS_URL")
    model = _require_env("OPENROUTER_MODEL")
    api_key = _get_api_key()

    content: list[dict[str, Any]] = [{"type": "text", "text": _schema_prompt()}]
    has_pdf_attachment = False
    for asset in assets:
        attachment_content = _build_attachment_content(asset)
        content.append(attachment_content)
        if (
            attachment_content.get("type") == "file"
            and _normalize_content_type(asset) == "application/pdf"
        ):
            has_pdf_attachment = True

    payload: dict[str, Any] = {
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
    if has_pdf_attachment:
        payload["plugins"] = [
            {
                "id": _PDF_PLUGIN_ID,
                "pdf": {"engine": _pdf_parser_engine()},
            }
        ]

    response = http_invoke(
        method="POST",
        url=endpoint_url,
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        },
        body=json.dumps(payload),
        timeout=30,
    )

    status_code = int(response.get("status", 0) or 0)
    body = str(response.get("body", "") or "")
    if status_code < 200 or status_code >= 300:
        preview = body.replace("\n", " ").replace("\r", " ").strip()
        if len(preview) > 500:
            preview = f"{preview[:500]}..."
        logger.warning(
            "OpenRouter request failed",
            extra={"status_code": status_code, "response_preview": preview or None},
        )
        detail = f": {preview}" if preview else ""
        raise RuntimeError(
            f"OpenRouter request failed with status {status_code}{detail}"
        )
    parsed = _parse_completion_body(body)
    logger.info("Invoice parse completed successfully")
    return _normalize_result(parsed)


def _build_attachment_content(asset: Mapping[str, Any]) -> dict[str, Any]:
    bucket = _require_env("ASSETS_BUCKET_NAME")
    max_file_bytes = _parse_max_file_bytes()

    s3_key = str(asset.get("s3_key") or "").strip()
    if not s3_key:
        raise RuntimeError("Attachment is missing s3_key")
    response = get_s3_client().get_object(Bucket=bucket, Key=s3_key)
    body = response["Body"].read()
    if len(body) > max_file_bytes:
        raise RuntimeError(f"Attachment {asset.get('id')} exceeds parser size limit")
    content_type = _normalize_content_type(asset)
    filename = str(asset.get("file_name") or "attachment")

    if content_type.startswith("image/"):
        encoded = base64.b64encode(body).decode("utf-8")
        data_url = f"data:{content_type};base64,{encoded}"
        return {
            "type": "image_url",
            "image_url": {
                "url": data_url,
            },
        }

    mime_primary = content_type.split(";", 1)[0].strip()
    if mime_primary == "text/plain":
        text = body.decode("utf-8")
        return {"type": "text", "text": text}

    encoded = base64.b64encode(body).decode("utf-8")
    data_url = f"data:{content_type};base64,{encoded}"
    return {
        "type": "file",
        "file": {
            "filename": filename,
            "file_data": data_url,
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
    if lowered_name.endswith(".txt"):
        return "text/plain"
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
    cleaned = (
        raw_text.strip()
        .removeprefix("```json")
        .removeprefix("```")
        .removesuffix("```")
        .strip()
    )
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
                    "description": _optional_text(
                        item.get("description"), max_length=500
                    ),
                    "quantity": _optional_number(item.get("quantity")),
                    "unit_price": _optional_money(item.get("unit_price")),
                    "amount": _optional_money(item.get("amount")),
                }
            )

    subtotal = _optional_money(parsed.get("subtotal"))
    if subtotal is None:
        subtotal = _first_optional_money(
            parsed,
            (
                "sub_total",
                "net_amount",
                "pretax_total",
                "amount_ex_tax",
                "subtotal_ex_tax",
            ),
        )

    tax = _optional_money(parsed.get("tax"))
    if tax is None:
        tax = _first_optional_money(
            parsed,
            (
                "tax_amount",
                "gst",
                "vat",
                "sales_tax",
            ),
        )

    total = _optional_money(parsed.get("total"))
    if total is None:
        total = _first_optional_money(
            parsed,
            (
                "grand_total",
                "invoice_total",
                "total_amount",
                "amount_due",
                "balance_due",
                "balance",
                "amount",
            ),
        )

    if total is None:
        total = _sum_line_item_amounts(normalized_line_items)

    currency = _optional_currency(parsed.get("currency"))
    if currency is None and _infer_usd_from_dollar_signs(parsed):
        currency = "USD"

    return {
        "vendor_name": _optional_text(parsed.get("vendor_name"), max_length=255),
        "invoice_number": _optional_text(parsed.get("invoice_number"), max_length=128),
        "invoice_date": _optional_iso_date(parsed.get("invoice_date")),
        "due_date": _optional_iso_date(parsed.get("due_date")),
        "currency": currency,
        "subtotal": subtotal,
        "tax": tax,
        "total": total,
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


def _optional_money(value: Any) -> float | None:
    """Parse a monetary field from JSON (handles formatted strings from the model)."""
    if value is None:
        return None
    if isinstance(value, bool):
        return None
    if isinstance(value, int):
        return float(value)
    if isinstance(value, float):
        if math.isnan(value) or math.isinf(value):
            return None
        return value
    return _parse_money_string(str(value))


def _first_optional_money(
    parsed: dict[str, Any], keys: tuple[str, ...]
) -> float | None:
    for key in keys:
        found = _optional_money(parsed.get(key))
        if found is not None:
            return found
    return None


def _sum_line_item_amounts(line_items: list[dict[str, Any]]) -> float | None:
    """Use sum of line amounts as total only when every line has a parsed amount."""
    if not line_items:
        return None
    amounts: list[float] = []
    for item in line_items:
        raw = item.get("amount")
        if raw is None:
            return None
        parsed = _optional_money(raw)
        if parsed is None:
            return None
        amounts.append(parsed)
    return sum(amounts)


def _parse_money_string(raw: str) -> float | None:
    s = raw.strip()
    if not s:
        return None

    neg = False
    if s.startswith("(") and s.endswith(")"):
        neg = True
        s = s[1:-1].strip()
    elif s.startswith("-"):
        neg = True
        s = s[1:].strip()

    s = re.sub(
        r"\s*(USD|EUR|GBP|AUD|NZD|CAD|HKD|CNY|JPY|CHF|SGD|INR|[A-Z]{3})\s*$",
        "",
        s,
        flags=re.IGNORECASE,
    ).strip()

    for sym in (
        "$",
        "\u00a3",
        "\u20ac",
        "\u00a5",
        "\u20b9",
        "\u00a2",
        "\u20a1",
    ):
        s = s.replace(sym, "")
    s = s.replace("\u00a0", " ").strip()

    compact = s.replace(" ", "")
    m = re.search(
        r"[+-]?(?:\d[\d.,]*\d|\d+\.\d+|\.\d+|\d+)",
        compact,
    )
    if not m:
        return None
    numeric = m.group(0)
    try:
        normalized = _normalize_decimal_grouping(numeric)
        out = float(normalized)
    except ValueError:
        return None
    return -out if neg else out


def _normalize_decimal_grouping(s: str) -> str:
    """Turn locale-style digit grouping into a float() parseable string."""
    negative = s.startswith("-")
    s = s.lstrip("+").lstrip("-")
    if not s:
        raise ValueError
    if "," in s and "." in s:
        if s.rfind(",") > s.rfind("."):
            s = s.replace(".", "").replace(",", ".")
        else:
            s = s.replace(",", "")
    elif "," in s:
        parts = s.split(",")
        if len(parts) == 2 and len(parts[1]) <= 2 and parts[1].isdigit():
            lead = parts[0].replace(".", "")
            s = f"{lead}.{parts[1]}"
        else:
            s = s.replace(",", "")
    prefix = "-" if negative else ""
    return prefix + s


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


_MONETARY_STRING_KEYS = (
    "subtotal",
    "tax",
    "total",
    "grand_total",
    "invoice_total",
    "total_amount",
    "amount_due",
    "balance_due",
    "balance",
    "amount",
    "sub_total",
    "net_amount",
    "pretax_total",
    "amount_ex_tax",
    "subtotal_ex_tax",
    "tax_amount",
    "gst",
    "vat",
    "sales_tax",
)

# Dollar prefixes that are not US dollars (avoid inferring USD from these).
_DISAMBIGUATED_DOLLAR_MARKERS = (
    "HK$",
    "NT$",
    "S$",
    "SG$",
    "NZ$",
    "CA$",
    "C$",
    "A$",
    "MX$",
    "AU$",
)

_OTHER_CURRENCY_MARKERS_RE = re.compile(r"[£€¥₹\u00a3\u20ac\u00a5\u20b9]")


def _optional_currency(value: Any) -> str | None:
    if value is None:
        return None
    raw = str(value).strip()
    if not raw:
        return None
    compact = raw.replace("\u00a0", " ").replace(" ", "").upper()
    if compact in {"$", "US$", "USD"}:
        return "USD"
    if re.fullmatch(r"\$+", raw.strip()):
        return "USD"
    normalized = _optional_text(raw, max_length=3)
    if normalized is None:
        return None
    letters_only = re.sub(r"[^A-Za-z]", "", normalized)
    if len(letters_only) == 3:
        return letters_only.upper()
    return None


def _infer_usd_from_dollar_signs(parsed: dict[str, Any]) -> bool:
    """True when monetary strings show $ but no other currency markers."""
    parts: list[str] = []
    for key in _MONETARY_STRING_KEYS:
        val = parsed.get(key)
        if isinstance(val, str) and val.strip():
            parts.append(val)
    line_items = parsed.get("line_items")
    if isinstance(line_items, list):
        for item in line_items:
            if not isinstance(item, dict):
                continue
            for li_key in ("amount", "unit_price"):
                val = item.get(li_key)
                if isinstance(val, str) and val.strip():
                    parts.append(val)
    if not parts:
        return False
    combined = "\n".join(parts)
    if "$" not in combined:
        return False
    upper = combined.upper()
    for marker in _DISAMBIGUATED_DOLLAR_MARKERS:
        if marker.upper() in upper:
            return False
    if _OTHER_CURRENCY_MARKERS_RE.search(combined):
        return False
    return True


def _parse_max_file_bytes() -> int:
    raw = os.getenv("OPENROUTER_MAX_FILE_BYTES", "").strip()
    if not raw:
        return 15 * 1024 * 1024
    try:
        parsed = int(raw)
    except ValueError:
        return 15 * 1024 * 1024
    return max(1, parsed)


def _pdf_parser_engine() -> str:
    configured = os.getenv("OPENROUTER_PDF_ENGINE", "").strip().lower()
    if configured in {"pdf-text", "mistral-ocr", "native"}:
        return configured
    return _DEFAULT_PDF_ENGINE


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
        "Use null for unknown values. No markdown. No prose. "
        "For subtotal, tax, and total prefer JSON numbers; if you use strings, use "
        "plain digits only (no currency symbols or thousands separators) when possible. "
        "If the invoice shows only the $ symbol for money (not HK$, S$, etc.), set "
        "currency to USD. "
        "Input may be plain text pasted in an email body rather than a PDF or image."
    )
