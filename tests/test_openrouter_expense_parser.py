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
    monkeypatch.setenv("CLIENT_ASSETS_BUCKET_NAME", "assets-bucket")
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


def test_parse_invoice_sends_pdfs_as_file_with_explicit_plugin(monkeypatch: Any) -> None:
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
