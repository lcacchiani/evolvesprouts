from __future__ import annotations

import json
from typing import Any

import pytest

from app.services import openrouter_expense_parser as parser


class _FakeBody:
    def __init__(self, data: bytes) -> None:
        self._data = data

    def read(self) -> bytes:
        return self._data


def _set_common_env(monkeypatch: Any) -> None:
    monkeypatch.setenv(
        "OPENROUTER_CHAT_COMPLETIONS_URL",
        "https://openrouter.ai/api/v1/chat/completions",
    )
    monkeypatch.setenv("OPENROUTER_MODEL", "openai/gpt-4.1-mini")
    monkeypatch.setenv("OPENROUTER_API_KEY_SECRET_ARN", "arn:aws:secretsmanager:test")
    monkeypatch.setenv("ASSETS_BUCKET_NAME", "assets-bucket")
    parser._api_key_cache = None


def _mock_secrets(monkeypatch: Any) -> None:
    class _FakeSecretsClient:
        def get_secret_value(self, SecretId: str) -> dict[str, str]:
            assert SecretId == "arn:aws:secretsmanager:test"
            return {"SecretString": json.dumps({"openrouter_api_key": "test-key"})}

    monkeypatch.setattr(
        parser,
        "get_secretsmanager_client",
        lambda: _FakeSecretsClient(),
    )


def test_parse_invoice_sends_images_as_image_url(monkeypatch: Any) -> None:
    _set_common_env(monkeypatch)
    _mock_secrets(monkeypatch)

    class _FakeS3Client:
        def get_object(self, Bucket: str, Key: str) -> dict[str, Any]:
            assert Bucket == "assets-bucket"
            assert Key == "uploads/invoice.png"
            return {"Body": _FakeBody(b"png-bytes")}

    captured_request: dict[str, Any] = {}

    def _fake_http_invoke(**kwargs: Any) -> dict[str, Any]:
        captured_request.update(kwargs)
        return {
            "status": 200,
            "body": json.dumps(
                {
                    "choices": [
                        {
                            "message": {
                                "content": json.dumps(
                                    {
                                        "vendor_name": "Acme Co",
                                        "invoice_number": None,
                                        "invoice_date": None,
                                        "due_date": None,
                                        "currency": "USD",
                                        "subtotal": 10,
                                        "tax": 0,
                                        "total": 10,
                                        "line_items": [],
                                        "confidence": 0.8,
                                    }
                                )
                            }
                        }
                    ]
                }
            ),
        }

    monkeypatch.setattr(parser, "get_s3_client", lambda: _FakeS3Client())
    monkeypatch.setattr(parser, "http_invoke", _fake_http_invoke)

    parser.parse_invoice_from_assets(
        [
            {
                "id": "asset-1",
                "s3_key": "uploads/invoice.png",
                "file_name": "invoice.png",
                "content_type": "image/png",
            }
        ]
    )

    payload = json.loads(captured_request["body"])
    user_content = payload["messages"][1]["content"]
    image_input = user_content[1]

    assert image_input["type"] == "image_url"
    assert image_input["image_url"]["url"].startswith("data:image/png;base64,")
    assert "plugins" not in payload
    assert payload["response_format"] == {"type": "json_object"}


def test_parse_invoice_sends_pdfs_as_file_with_explicit_plugin(
    monkeypatch: Any,
) -> None:
    _set_common_env(monkeypatch)
    _mock_secrets(monkeypatch)

    class _FakeS3Client:
        def get_object(self, Bucket: str, Key: str) -> dict[str, Any]:
            assert Bucket == "assets-bucket"
            assert Key == "uploads/invoice.pdf"
            return {"Body": _FakeBody(b"%PDF-1.4")}

    captured_request: dict[str, Any] = {}

    def _fake_http_invoke(**kwargs: Any) -> dict[str, Any]:
        captured_request.update(kwargs)
        return {
            "status": 200,
            "body": json.dumps(
                {
                    "choices": [
                        {
                            "message": {
                                "content": json.dumps(
                                    {
                                        "vendor_name": "Acme Co",
                                        "invoice_number": None,
                                        "invoice_date": None,
                                        "due_date": None,
                                        "currency": "USD",
                                        "subtotal": 10,
                                        "tax": 0,
                                        "total": 10,
                                        "line_items": [],
                                        "confidence": 0.9,
                                    }
                                )
                            }
                        }
                    ]
                }
            ),
        }

    monkeypatch.setattr(parser, "get_s3_client", lambda: _FakeS3Client())
    monkeypatch.setattr(parser, "http_invoke", _fake_http_invoke)

    parser.parse_invoice_from_assets(
        [
            {
                "id": "asset-2",
                "s3_key": "uploads/invoice.pdf",
                "file_name": "invoice.pdf",
                "content_type": "application/pdf",
            }
        ]
    )

    payload = json.loads(captured_request["body"])
    user_content = payload["messages"][1]["content"]
    file_input = user_content[1]

    assert file_input["type"] == "file"
    assert file_input["file"]["file_data"].startswith("data:application/pdf;base64,")
    assert payload["plugins"] == [
        {
            "id": "file-parser",
            "pdf": {"engine": "mistral-ocr"},
        }
    ]


def test_parse_invoice_sends_plain_text_body_as_text_block(monkeypatch: Any) -> None:
    _set_common_env(monkeypatch)
    _mock_secrets(monkeypatch)
    text_bytes = b"Invoice INV-T\nTotal 42.00 USD\n"

    class _FakeS3Client:
        def get_object(self, Bucket: str, Key: str) -> dict[str, Any]:
            assert Bucket == "assets-bucket"
            assert Key == "uploads/email-invoice-body.txt"
            return {"Body": _FakeBody(text_bytes)}

    captured_request: dict[str, Any] = {}

    def _fake_http_invoke(**kwargs: Any) -> dict[str, Any]:
        captured_request.update(kwargs)
        return {
            "status": 200,
            "body": json.dumps(
                {
                    "choices": [
                        {
                            "message": {
                                "content": json.dumps(
                                    {
                                        "vendor_name": "Text Vendor",
                                        "invoice_number": "INV-T",
                                        "invoice_date": None,
                                        "due_date": None,
                                        "currency": "USD",
                                        "subtotal": None,
                                        "tax": None,
                                        "total": 42,
                                        "line_items": [],
                                        "confidence": 0.5,
                                    }
                                )
                            }
                        }
                    ]
                }
            ),
        }

    monkeypatch.setattr(parser, "get_s3_client", lambda: _FakeS3Client())
    monkeypatch.setattr(parser, "http_invoke", _fake_http_invoke)

    parser.parse_invoice_from_assets(
        [
            {
                "id": "asset-txt",
                "s3_key": "uploads/email-invoice-body.txt",
                "file_name": "email-invoice-body.txt",
                "content_type": "text/plain",
            }
        ]
    )

    payload = json.loads(captured_request["body"])
    user_content = payload["messages"][1]["content"]
    text_input = user_content[1]

    assert text_input["type"] == "text"
    assert text_input["text"] == text_bytes.decode("utf-8")
    assert "plugins" not in payload


def test_parse_invoice_uses_configured_pdf_engine(monkeypatch: Any) -> None:
    _set_common_env(monkeypatch)
    _mock_secrets(monkeypatch)
    monkeypatch.setenv("OPENROUTER_PDF_ENGINE", "pdf-text")

    class _FakeS3Client:
        def get_object(self, Bucket: str, Key: str) -> dict[str, Any]:
            return {"Body": _FakeBody(b"%PDF-1.7")}

    captured_request: dict[str, Any] = {}

    def _fake_http_invoke(**kwargs: Any) -> dict[str, Any]:
        captured_request.update(kwargs)
        return {
            "status": 200,
            "body": json.dumps(
                {
                    "choices": [
                        {
                            "message": {
                                "content": '{"vendor_name": null, "invoice_number": null,'
                                ' "invoice_date": null, "due_date": null, "currency": null,'
                                ' "subtotal": null, "tax": null, "total": null,'
                                ' "line_items": [], "confidence": null}'
                            }
                        }
                    ]
                }
            ),
        }

    monkeypatch.setattr(parser, "get_s3_client", lambda: _FakeS3Client())
    monkeypatch.setattr(parser, "http_invoke", _fake_http_invoke)

    parser.parse_invoice_from_assets(
        [
            {
                "id": "asset-3",
                "s3_key": "uploads/invoice-two.pdf",
                "file_name": "invoice-two.pdf",
                "content_type": "application/pdf",
            }
        ]
    )

    payload = json.loads(captured_request["body"])
    assert payload["plugins"][0]["pdf"]["engine"] == "pdf-text"


def test_normalize_result_parses_currency_formatted_total() -> None:
    out = parser._normalize_result(
        {
            "vendor_name": "Acme",
            "invoice_number": None,
            "invoice_date": None,
            "due_date": None,
            "currency": "USD",
            "subtotal": None,
            "tax": None,
            "total": "$1,234.56",
            "line_items": [],
            "confidence": None,
        }
    )
    assert out["total"] == 1234.56


def test_normalize_result_maps_amount_key_to_total() -> None:
    out = parser._normalize_result(
        {
            "vendor_name": None,
            "invoice_number": None,
            "invoice_date": None,
            "due_date": None,
            "currency": None,
            "subtotal": None,
            "tax": None,
            "total": None,
            "amount": "€ 99,00",
            "line_items": [],
            "confidence": None,
        }
    )
    assert out["total"] == 99.0


def test_normalize_result_total_from_line_items_when_total_missing() -> None:
    out = parser._normalize_result(
        {
            "vendor_name": None,
            "invoice_number": None,
            "invoice_date": None,
            "due_date": None,
            "currency": None,
            "subtotal": None,
            "tax": None,
            "total": None,
            "line_items": [
                {
                    "description": "A",
                    "quantity": 1,
                    "unit_price": 10,
                    "amount": "10.00",
                },
                {"description": "B", "quantity": 1, "unit_price": 5, "amount": "$5.00"},
            ],
            "confidence": None,
        }
    )
    assert out["total"] == 15.0
    assert out["currency"] == "USD"


def test_normalize_result_maps_currency_dollar_sign_to_usd() -> None:
    out = parser._normalize_result(
        {
            "vendor_name": None,
            "invoice_number": None,
            "invoice_date": None,
            "due_date": None,
            "currency": "$",
            "subtotal": None,
            "tax": None,
            "total": 30,
            "line_items": [],
            "confidence": None,
        }
    )
    assert out["currency"] == "USD"


def test_normalize_result_infers_usd_from_plain_dollar_total_string() -> None:
    out = parser._normalize_result(
        {
            "vendor_name": None,
            "invoice_number": None,
            "invoice_date": None,
            "due_date": None,
            "currency": None,
            "subtotal": None,
            "tax": None,
            "total": "$30.00",
            "line_items": [],
            "confidence": None,
        }
    )
    assert out["currency"] == "USD"


def test_normalize_result_does_not_infer_usd_for_hk_dollar() -> None:
    out = parser._normalize_result(
        {
            "vendor_name": None,
            "invoice_number": None,
            "invoice_date": None,
            "due_date": None,
            "currency": None,
            "subtotal": None,
            "tax": None,
            "total": "HK$100.00",
            "line_items": [],
            "confidence": None,
        }
    )
    assert out["currency"] is None


def test_normalize_result_does_not_infer_usd_when_euro_marker_present() -> None:
    out = parser._normalize_result(
        {
            "vendor_name": None,
            "invoice_number": None,
            "invoice_date": None,
            "due_date": None,
            "currency": None,
            "subtotal": "€10.00",
            "tax": None,
            "total": "$5.00",
            "line_items": [],
            "confidence": None,
        }
    )
    assert out["currency"] is None


def test_parse_invoice_surfaces_openrouter_error_body(monkeypatch: Any) -> None:
    _set_common_env(monkeypatch)
    _mock_secrets(monkeypatch)

    class _FakeS3Client:
        def get_object(self, Bucket: str, Key: str) -> dict[str, Any]:
            return {"Body": _FakeBody(b"x")}

    def _fake_http_invoke(**_kwargs: Any) -> dict[str, Any]:
        return {
            "status": 404,
            "body": '{"error":{"message":"No endpoints found for google/gpt-4"}}',
        }

    monkeypatch.setattr(parser, "get_s3_client", lambda: _FakeS3Client())
    monkeypatch.setattr(parser, "http_invoke", _fake_http_invoke)

    with pytest.raises(RuntimeError) as exc_info:
        parser.parse_invoice_from_assets(
            [
                {
                    "id": "asset-e",
                    "s3_key": "k",
                    "file_name": "i.png",
                    "content_type": "image/png",
                }
            ]
        )

    assert "404" in str(exc_info.value)
    assert "No endpoints found" in str(exc_info.value)


def test_parse_bulk_expense_invoices_normalizes_each_row(monkeypatch: Any) -> None:
    _set_common_env(monkeypatch)
    _mock_secrets(monkeypatch)

    class _FakeS3Client:
        def get_object(self, Bucket: str, Key: str) -> dict[str, Any]:
            return {"Body": _FakeBody(b"%PDF-1.4")}

    def _fake_http_invoke(**kwargs: Any) -> dict[str, Any]:
        assert kwargs["timeout"] == 25
        payload = json.loads(kwargs["body"])
        assert payload["plugins"][0]["id"] == "file-parser"
        return {
            "status": 200,
            "body": json.dumps(
                {
                    "choices": [
                        {
                            "message": {
                                "content": json.dumps(
                                    {
                                        "invoices": [
                                            {
                                                "vendor_name": "Shop A",
                                                "invoice_number": "1",
                                                "invoice_date": "2026-01-02",
                                                "due_date": None,
                                                "currency": "HKD",
                                                "subtotal": 10,
                                                "tax": 0,
                                                "total": 10,
                                                "line_items": [],
                                                "confidence": 0.9,
                                            },
                                            {
                                                "vendor_name": "Shop B",
                                                "invoice_number": "2",
                                                "invoice_date": "2026-01-03",
                                                "due_date": None,
                                                "currency": "HKD",
                                                "subtotal": 20,
                                                "tax": 0,
                                                "total": 20,
                                                "line_items": [],
                                                "confidence": 0.8,
                                            },
                                        ]
                                    }
                                )
                            }
                        }
                    ]
                }
            ),
        }

    monkeypatch.setattr(parser, "get_s3_client", lambda: _FakeS3Client())
    monkeypatch.setattr(parser, "http_invoke", _fake_http_invoke)

    rows = parser.parse_bulk_expense_invoices_from_assets(
        [
            {
                "id": "asset-b",
                "s3_key": "k",
                "file_name": "bulk.pdf",
                "content_type": "application/pdf",
            }
        ],
        timeout=25,
    )
    assert len(rows) == 2
    assert rows[0]["invoice_number"] == "1"
    assert rows[0]["total"] == 10.0
    assert rows[1]["vendor_name"] == "Shop B"


def _bulk_chat_completion_body(content_text: str) -> str:
    return json.dumps(
        {
            "choices": [
                {
                    "message": {
                        "content": content_text,
                    }
                }
            ]
        }
    )


def test_parse_bulk_expense_invoices_sets_json_response_format(
    monkeypatch: Any,
) -> None:
    _set_common_env(monkeypatch)
    _mock_secrets(monkeypatch)

    class _FakeS3Client:
        def get_object(self, Bucket: str, Key: str) -> dict[str, Any]:
            return {"Body": _FakeBody(b"%PDF-1.4")}

    captured_payloads: list[dict[str, Any]] = []

    def _fake_http_invoke(**kwargs: Any) -> dict[str, Any]:
        captured_payloads.append(json.loads(kwargs["body"]))
        return {
            "status": 200,
            "body": _bulk_chat_completion_body(
                json.dumps(
                    {
                        "invoices": [
                            {
                                "vendor_name": "Shop",
                                "invoice_number": "1",
                                "invoice_date": "2026-01-01",
                                "due_date": None,
                                "currency": "HKD",
                                "subtotal": 1,
                                "tax": 0,
                                "total": 1,
                                "line_items": [],
                                "confidence": 0.9,
                            }
                        ]
                    }
                )
            ),
        }

    monkeypatch.setattr(parser, "get_s3_client", lambda: _FakeS3Client())
    monkeypatch.setattr(parser, "http_invoke", _fake_http_invoke)

    parser.parse_bulk_expense_invoices_from_assets(
        [
            {
                "id": "asset-rf",
                "s3_key": "k",
                "file_name": "bulk.pdf",
                "content_type": "application/pdf",
            }
        ],
        timeout=25,
    )

    assert len(captured_payloads) == 1
    assert captured_payloads[0]["response_format"] == {"type": "json_object"}


def test_parse_bulk_expense_invoices_repairs_invalid_json(monkeypatch: Any) -> None:
    _set_common_env(monkeypatch)
    _mock_secrets(monkeypatch)

    class _FakeS3Client:
        def get_object(self, Bucket: str, Key: str) -> dict[str, Any]:
            return {"Body": _FakeBody(b"%PDF-1.4")}

    valid_payload = {
        "invoices": [
            {
                "vendor_name": "Shop",
                "invoice_number": "1",
                "invoice_date": "2026-02-03",
                "due_date": None,
                "currency": "HKD",
                "subtotal": 5,
                "tax": 0,
                "total": 5,
                "line_items": [
                    {
                        "description": 'Apple iPhone 15 "Pro" case 6.1"',
                        "quantity": 1,
                        "unit_price": 5,
                        "amount": 5,
                    }
                ],
                "confidence": 0.9,
            }
        ]
    }
    # Hand-crafted broken JSON (unescaped inner quote in description) that mimics
    # the production failure mode.
    broken_text = (
        '{"invoices": [{"vendor_name": "Shop", "invoice_number": "1",'
        ' "invoice_date": "2026-02-03", "due_date": null, "currency": "HKD",'
        ' "subtotal": 5, "tax": 0, "total": 5,'
        ' "line_items": [{"description": "Apple iPhone 15 "Pro" case 6.1"",'
        ' "quantity": 1, "unit_price": 5, "amount": 5}],'
        ' "confidence": 0.9}]}'
    )

    call_log: list[dict[str, Any]] = []

    def _fake_http_invoke(**kwargs: Any) -> dict[str, Any]:
        payload = json.loads(kwargs["body"])
        call_log.append(payload)
        if len(call_log) == 1:
            return {
                "status": 200,
                "body": _bulk_chat_completion_body(broken_text),
            }
        return {
            "status": 200,
            "body": _bulk_chat_completion_body(json.dumps(valid_payload)),
        }

    monkeypatch.setattr(parser, "get_s3_client", lambda: _FakeS3Client())
    monkeypatch.setattr(parser, "http_invoke", _fake_http_invoke)

    rows = parser.parse_bulk_expense_invoices_from_assets(
        [
            {
                "id": "asset-repair",
                "s3_key": "k",
                "file_name": "bulk.pdf",
                "content_type": "application/pdf",
            }
        ],
        timeout=25,
    )

    assert len(call_log) == 2, "expected one initial call plus one repair call"
    repair_call = call_log[1]
    assert "plugins" not in repair_call, "repair call must not re-attach the PDF plugin"
    repair_user_text = repair_call["messages"][1]["content"][0]["text"]
    assert "BROKEN_JSON_BEGIN" in repair_user_text
    assert "Apple iPhone 15" in repair_user_text
    assert len(rows) == 1
    assert rows[0]["invoice_number"] == "1"
    assert rows[0]["total"] == 5.0


def test_coerce_bulk_invoice_list_passes_through_top_level_array() -> None:
    rows = [{"vendor_name": "A"}, {"vendor_name": "B"}]
    assert parser._coerce_bulk_invoice_list(rows) is rows


def test_coerce_bulk_invoice_list_accepts_alias_keys() -> None:
    rows = [{"vendor_name": "A"}]
    for key in ("invoices", "records", "data", "results", "rows", "expenses"):
        assert parser._coerce_bulk_invoice_list({key: rows}) == rows


def test_coerce_bulk_invoice_list_uses_single_unknown_list_of_dicts() -> None:
    rows = [{"vendor_name": "Acme", "total": 10}]
    out = parser._coerce_bulk_invoice_list({"meta": {"page_count": 1}, "things": rows})
    assert out == rows


def test_coerce_bulk_invoice_list_picks_most_invoice_like_when_multiple() -> None:
    invoice_like = [{"vendor_name": "Acme", "total": 1}]
    decoy = [{"some_other": "value"}]
    out = parser._coerce_bulk_invoice_list({"noise": decoy, "best_match": invoice_like})
    assert out == invoice_like


def test_coerce_bulk_invoice_list_wraps_single_top_level_invoice() -> None:
    single = {"vendor_name": "Acme", "total": 10, "currency": "USD"}
    out = parser._coerce_bulk_invoice_list(single)
    assert out == [single]


def test_coerce_bulk_invoice_list_raises_with_keys_preview_on_unknown_shape() -> None:
    with pytest.raises(RuntimeError) as exc_info:
        parser._coerce_bulk_invoice_list({"alpha": "x", "beta": 2, "gamma": [1, 2, 3]})
    msg = str(exc_info.value)
    assert "alpha" in msg
    assert "beta" in msg
    assert "gamma" in msg


def test_parse_bulk_expense_invoices_accepts_data_alias(monkeypatch: Any) -> None:
    _set_common_env(monkeypatch)
    _mock_secrets(monkeypatch)

    class _FakeS3Client:
        def get_object(self, Bucket: str, Key: str) -> dict[str, Any]:
            return {"Body": _FakeBody(b"%PDF-1.4")}

    payload_text = json.dumps(
        {
            "data": [
                {
                    "vendor_name": "Shop X",
                    "invoice_number": "9",
                    "invoice_date": "2026-03-04",
                    "due_date": None,
                    "currency": "USD",
                    "subtotal": 8,
                    "tax": 0,
                    "total": 8,
                    "line_items": [],
                    "confidence": 0.9,
                }
            ]
        }
    )

    def _fake_http_invoke(**_kwargs: Any) -> dict[str, Any]:
        return {
            "status": 200,
            "body": _bulk_chat_completion_body(payload_text),
        }

    monkeypatch.setattr(parser, "get_s3_client", lambda: _FakeS3Client())
    monkeypatch.setattr(parser, "http_invoke", _fake_http_invoke)

    rows = parser.parse_bulk_expense_invoices_from_assets(
        [
            {
                "id": "asset-data",
                "s3_key": "k",
                "file_name": "bulk.pdf",
                "content_type": "application/pdf",
            }
        ],
        timeout=25,
    )
    assert len(rows) == 1
    assert rows[0]["vendor_name"] == "Shop X"
    assert rows[0]["total"] == 8.0


def test_parse_bulk_expense_invoices_raises_with_snippet_when_repair_fails(
    monkeypatch: Any,
) -> None:
    _set_common_env(monkeypatch)
    _mock_secrets(monkeypatch)

    class _FakeS3Client:
        def get_object(self, Bucket: str, Key: str) -> dict[str, Any]:
            return {"Body": _FakeBody(b"%PDF-1.4")}

    broken_text = (
        '{"invoices": [{"vendor_name": "Shop A", "description":'
        ' "MARKER_TOKEN "Pro" model"}]}'
    )

    def _fake_http_invoke(**_kwargs: Any) -> dict[str, Any]:
        return {
            "status": 200,
            "body": _bulk_chat_completion_body(broken_text),
        }

    monkeypatch.setattr(parser, "get_s3_client", lambda: _FakeS3Client())
    monkeypatch.setattr(parser, "http_invoke", _fake_http_invoke)

    with pytest.raises(RuntimeError) as exc_info:
        parser.parse_bulk_expense_invoices_from_assets(
            [
                {
                    "id": "asset-fail",
                    "s3_key": "k",
                    "file_name": "bulk.pdf",
                    "content_type": "application/pdf",
                }
            ],
            timeout=25,
        )

    msg = str(exc_info.value)
    assert "even after repair" in msg
    assert "MARKER_TOKEN" in msg
