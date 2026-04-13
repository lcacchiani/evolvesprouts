from __future__ import annotations

from typing import Any
from unittest.mock import MagicMock

from app.services import public_form_admin_notifications as n


def test_list_admin_notification_emails_empty_without_env(monkeypatch: Any) -> None:
    monkeypatch.delenv("COGNITO_USER_POOL_ID", raising=False)
    monkeypatch.delenv("AWS_PROXY_FUNCTION_ARN", raising=False)
    assert n.list_admin_notification_emails() == []


def test_list_admin_notification_emails_collects_pages(monkeypatch: Any) -> None:
    monkeypatch.setenv("COGNITO_USER_POOL_ID", "pool-1")
    monkeypatch.setenv("AWS_PROXY_FUNCTION_ARN", "arn:aws:lambda:us-east-1:1:function:proxy")
    monkeypatch.setenv("ADMIN_GROUP", "admin")

    def _fake_invoke(_service: str, _action: str, params: dict[str, Any]) -> dict[str, Any]:
        if "NextToken" not in params:
            return {
                "Users": [
                    {
                        "Attributes": [
                            {"Name": "email", "Value": "A@Example.com"},
                        ],
                    }
                ],
                "NextToken": "t1",
            }
        return {
            "Users": [
                {
                    "Attributes": [
                        {"Name": "email", "Value": "b@example.com"},
                    ],
                }
            ],
        }

    monkeypatch.setattr(n, "invoke", _fake_invoke)
    assert n.list_admin_notification_emails() == ["a@example.com", "b@example.com"]


def test_send_contact_inquiry_support_email_skips_without_config(monkeypatch: Any) -> None:
    monkeypatch.delenv("SUPPORT_EMAIL", raising=False)
    monkeypatch.delenv("SES_SENDER_EMAIL", raising=False)
    mock_send = MagicMock()
    monkeypatch.setattr(n, "send_email", mock_send)
    n.send_contact_inquiry_support_email(
        payload={"first_name": "x", "email_address": "u@example.com", "message": "hi"}
    )
    mock_send.assert_not_called()


def test_send_contact_inquiry_support_email_sends(monkeypatch: Any) -> None:
    monkeypatch.setenv("SUPPORT_EMAIL", "support@example.com")
    monkeypatch.setenv("SES_SENDER_EMAIL", "noreply@example.com")
    captured: dict[str, Any] = {}

    def _fake_send(**kwargs: Any) -> None:
        captured.update(kwargs)

    monkeypatch.setattr(n, "send_email", _fake_send)
    n.send_contact_inquiry_support_email(
        payload={
            "first_name": "Pat",
            "email_address": "u@example.com",
            "phone_number": "+1",
            "message": "Hello",
            "signup_intent": "contact_inquiry",
            "marketing_opt_in": True,
            "locale": "en",
        }
    )
    assert captured["to_addresses"] == ["support@example.com"]
    assert "Contact inquiry" in captured["subject"]
    assert "Hello" in captured["body_text"]
