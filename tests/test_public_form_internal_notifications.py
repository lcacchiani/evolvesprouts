from __future__ import annotations

from typing import Any
from unittest.mock import MagicMock

import pytest

from app.services import public_form_internal_notifications as n


def test_list_sales_recap_recipient_emails_empty_without_env(monkeypatch: Any) -> None:
    monkeypatch.delenv("COGNITO_USER_POOL_ID", raising=False)
    monkeypatch.delenv("AWS_PROXY_FUNCTION_ARN", raising=False)
    assert n.list_sales_recap_recipient_emails() == []


def test_list_sales_recap_recipient_emails_collects_pages(monkeypatch: Any) -> None:
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
    assert n.list_sales_recap_recipient_emails() == ["a@example.com", "b@example.com"]


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


def test_send_sales_form_recap_required_raises_without_sender(monkeypatch: Any) -> None:
    monkeypatch.delenv("SES_SENDER_EMAIL", raising=False)
    monkeypatch.setattr(n, "list_sales_recap_recipient_emails", lambda: ["a@example.com"])
    with pytest.raises(RuntimeError, match="SES_SENDER_EMAIL"):
        n.send_sales_form_recap_email(
            form_title="X",
            body_lines=["line"],
            required=True,
        )


def test_send_sales_form_recap_required_raises_without_recipients(monkeypatch: Any) -> None:
    monkeypatch.setenv("SES_SENDER_EMAIL", "noreply@example.com")
    monkeypatch.setattr(n, "list_sales_recap_recipient_emails", lambda: [])
    with pytest.raises(RuntimeError, match="No sales recap recipients"):
        n.send_sales_form_recap_email(
            form_title="X",
            body_lines=["line"],
            required=True,
        )


def test_send_sales_form_recap_optional_swallows_send_failure(monkeypatch: Any) -> None:
    monkeypatch.setenv("SES_SENDER_EMAIL", "noreply@example.com")
    monkeypatch.setattr(n, "list_sales_recap_recipient_emails", lambda: ["a@example.com"])

    def _boom(**_kwargs: Any) -> None:
        raise RuntimeError("ses down")

    log_mock = MagicMock()
    monkeypatch.setattr(n, "send_email", _boom)
    monkeypatch.setattr("app.services.public_form_internal_notifications.logger", log_mock)
    n.send_sales_form_recap_email(
        form_title="X",
        body_lines=["line"],
        required=False,
    )
    log_mock.exception.assert_called_once()


def test_send_sales_form_recap_uses_run_with_retry_when_configured(monkeypatch: Any) -> None:
    monkeypatch.setenv("SES_SENDER_EMAIL", "noreply@example.com")
    monkeypatch.setattr(n, "list_sales_recap_recipient_emails", lambda: ["a@example.com"])
    retry_calls: list[Any] = []

    def _fake_retry(op: Any, *args: Any, **kwargs: Any) -> None:
        retry_calls.append((op, args, kwargs))
        send_kwargs = {
            k: v for k, v in kwargs.items() if k not in ("logger", "operation_name")
        }
        op(*args, **send_kwargs)

    monkeypatch.setattr(n, "run_with_retry", _fake_retry)
    sent: dict[str, Any] = {}

    def _capture_send(**kwargs: Any) -> None:
        sent.update(kwargs)

    monkeypatch.setattr(n, "send_email", _capture_send)
    n.send_sales_form_recap_email(
        form_title="Media",
        body_lines=["a", "b"],
        required=False,
        retry_transient_failures=True,
    )
    assert len(retry_calls) == 1
    assert retry_calls[0][0] is n.send_email
    assert sent["to_addresses"] == ["a@example.com"]
    assert "Media" in sent["subject"]


def test_build_contact_us_recap_lines_includes_intent_summary() -> None:
    lines = n.build_contact_us_recap_lines(
        payload={
            "first_name": "Pat",
            "email_address": "p@example.com",
            "message": "Hi",
            "signup_intent": "community_newsletter",
        }
    )
    assert any("Community / newsletter" in ln for ln in lines)
    assert "p@example.com" in "\n".join(lines)


def test_build_media_lead_recap_lines(monkeypatch: Any) -> None:
    monkeypatch.setenv("SALES_RECAP_DISPLAY_TIMEZONE", "Asia/Hong_Kong")
    lines = n.build_media_lead_recap_lines(
        first_name="A",
        email="a@example.com",
        media_name="Guide",
        resource_key="rk",
        submitted_at="2026-03-03T03:14:00+00:00",
        marketing_opt_in=True,
        locale="en",
    )
    body = "\n".join(lines)
    assert "Guide" in body and "rk" in body and "True" in body
    assert "Submitted at: 2026-03-03 11:14:00 HKT" in body


def test_build_media_lead_recap_respects_display_timezone_env(
    monkeypatch: Any,
) -> None:
    monkeypatch.setenv("SALES_RECAP_DISPLAY_TIMEZONE", "America/New_York")
    lines = n.build_media_lead_recap_lines(
        first_name="A",
        email="a@example.com",
        media_name="Guide",
        resource_key="rk",
        submitted_at="2026-03-03T03:14:00+00:00",
        marketing_opt_in=False,
        locale="en",
    )
    assert "Submitted at: 2026-03-02 22:14:00 EST" in "\n".join(lines)


def test_format_submitted_at_recap_display_unparseable_returns_original() -> None:
    lines = n.build_media_lead_recap_lines(
        first_name="A",
        email="a@example.com",
        media_name="G",
        resource_key="k",
        submitted_at="not-a-date",
        marketing_opt_in=False,
        locale="en",
    )
    assert "Submitted at: not-a-date" in "\n".join(lines)


def test_sales_recap_display_timezone_invalid_env_falls_back(
    monkeypatch: Any,
) -> None:
    monkeypatch.setenv("SALES_RECAP_DISPLAY_TIMEZONE", "Not/A/Zone")
    lines = n.build_media_lead_recap_lines(
        first_name="A",
        email="a@example.com",
        media_name="G",
        resource_key="k",
        submitted_at="2026-03-03T03:14:00+00:00",
        marketing_opt_in=False,
        locale="en",
    )
    assert "Submitted at: 2026-03-03 11:14:00 HKT" in "\n".join(lines)


def test_build_reservation_recap_lines_optional_fields() -> None:
    lines = n.build_reservation_recap_lines(
        payload={
            "attendee_name": "N",
            "attendee_email": "n@example.com",
            "attendee_phone": "1",
            "child_age_group": "2",
            "package_label": "P",
            "month_label": "M",
            "course_label": "C",
            "payment_method": "fps",
            "total_amount": "100",
            "stripe_payment_intent_id": "pi_x",
            "schedule_date_label": "D",
            "schedule_time_label": "T",
            "interested_topics": "sleep",
            "comments_field_label": "What should we know?",
        }
    )
    body = "\n".join(lines)
    assert "pi_x" in body and "sleep" in body
    assert "Telephone: 1" in body
    assert "Question (What should we know?):" in body


def test_build_reservation_recap_lines_consultation_focus_and_level() -> None:
    lines = n.build_reservation_recap_lines(
        payload={
            "attendee_name": "N",
            "attendee_email": "n@example.com",
            "attendee_phone": "999",
            "child_age_group": "2",
            "package_label": "P",
            "month_label": "M",
            "course_label": "C",
            "payment_method": "fps",
            "total_amount": "100",
            "consultation_writing_focus_label": "Home routines",
            "consultation_level_label": "Essentials",
        }
    )
    body = "\n".join(lines)
    assert "Focus: Home routines" in body
    assert "Level: Essentials" in body
