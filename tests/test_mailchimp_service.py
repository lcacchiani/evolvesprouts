from __future__ import annotations

import json
from typing import Any

import pytest

import app.services.mailchimp as mailchimp


def test_mailchimp_logs_error_body_on_member_upsert_failure(monkeypatch: Any) -> None:
    monkeypatch.setattr(mailchimp, "_api_key_cache", "fake-key-us12")
    monkeypatch.setenv("MAILCHIMP_LIST_ID", "list1")
    monkeypatch.setenv("MAILCHIMP_SERVER_PREFIX", "us12")

    def fake_http_invoke(**_kwargs: Any) -> dict[str, Any]:
        return {
            "status": 401,
            "body": '{"title":"API Key Invalid","detail":"Your API key may be invalid.","status":401}',
        }

    monkeypatch.setattr(mailchimp, "http_invoke", fake_http_invoke)
    recorded: list[tuple[str, dict[str, Any]]] = []

    def capture_warning(msg: str, *, extra: dict[str, Any] | None = None, **_kw: Any) -> None:
        recorded.append((msg, extra or {}))

    monkeypatch.setattr(mailchimp.logger, "warning", capture_warning)

    with pytest.raises(mailchimp.MailchimpApiError):
        mailchimp.add_subscriber_with_tag(
            email="a@example.com",
            first_name="A",
            tag_name="tag-one",
        )

    assert len(recorded) == 1
    assert recorded[0][0] == "Mailchimp upsert failed"
    extra = recorded[0][1]
    assert extra.get("mailchimp_step") == "upsert_member"
    assert "API Key Invalid" in extra.get("mailchimp_error_body", "")


def test_mailchimp_logs_error_body_on_tag_apply_failure(monkeypatch: Any) -> None:
    monkeypatch.setattr(mailchimp, "_api_key_cache", "fake-key-us12")
    monkeypatch.setenv("MAILCHIMP_LIST_ID", "list1")
    monkeypatch.setenv("MAILCHIMP_SERVER_PREFIX", "us12")

    def fake_http_invoke(**kwargs: Any) -> dict[str, Any]:
        if kwargs.get("method") == "PUT":
            return {"status": 200, "body": '{"id":"sub-1","email_address":"a@example.com"}'}
        return {
            "status": 403,
            "body": '{"title":"Forbidden","detail":"User does not have access","status":403}',
        }

    monkeypatch.setattr(mailchimp, "http_invoke", fake_http_invoke)
    recorded: list[tuple[str, dict[str, Any]]] = []

    def capture_warning(msg: str, *, extra: dict[str, Any] | None = None, **_kw: Any) -> None:
        recorded.append((msg, extra or {}))

    monkeypatch.setattr(mailchimp.logger, "warning", capture_warning)

    with pytest.raises(mailchimp.MailchimpApiError):
        mailchimp.add_subscriber_with_tag(
            email="a@example.com",
            first_name="A",
            tag_name="tag-one",
        )

    assert len(recorded) == 1
    assert recorded[0][0] == "Mailchimp tag apply failed"
    extra = recorded[0][1]
    assert extra.get("mailchimp_step") == "apply_tags"
    assert "Forbidden" in extra.get("mailchimp_error_body", "")


def test_mailchimp_member_payload_includes_merge_fields(monkeypatch: Any) -> None:
    monkeypatch.setattr(mailchimp, "_api_key_cache", "fake-key-us12")
    monkeypatch.setenv("MAILCHIMP_LIST_ID", "list1")
    monkeypatch.setenv("MAILCHIMP_SERVER_PREFIX", "us12")
    captured: list[str] = []

    def fake_http_invoke(**kwargs: Any) -> dict[str, Any]:
        if kwargs.get("method") == "PUT":
            captured.append(str(kwargs.get("body") or ""))
            return {"status": 200, "body": '{"id":"sub-1"}'}
        return {"status": 200, "body": "{}"}

    monkeypatch.setattr(mailchimp, "http_invoke", fake_http_invoke)
    mailchimp.add_subscriber_with_tag(
        email="a@example.com",
        first_name="A",
        tag_name="tag-one",
        merge_fields={"MMDLURL": "https://example.com/v1/assets/share/TOKEN"},
    )
    assert len(captured) == 1
    payload = json.loads(captured[0])
    assert payload["merge_fields"]["FNAME"] == "A"
    assert payload["merge_fields"]["MMDLURL"] == "https://example.com/v1/assets/share/TOKEN"


def test_trigger_customer_journey_posts_correct_url_and_body(monkeypatch: Any) -> None:
    monkeypatch.setattr(mailchimp, "_api_key_cache", "fake-key-us12")
    monkeypatch.setenv("MAILCHIMP_SERVER_PREFIX", "us12")
    calls: list[dict[str, Any]] = []

    def fake_http_invoke(**kwargs: Any) -> dict[str, Any]:
        calls.append(kwargs)
        return {"status": 204, "body": ""}

    monkeypatch.setattr(mailchimp, "http_invoke", fake_http_invoke)
    mailchimp.trigger_customer_journey(
        email="User@Example.com",
        journey_id="4190",
        step_id="29098",
    )
    assert len(calls) == 1
    assert calls[0]["method"] == "POST"
    assert calls[0]["url"] == (
        "https://us12.api.mailchimp.com/3.0/customer-journeys/journeys/"
        "4190/steps/29098/actions/trigger"
    )
    assert json.loads(calls[0]["body"]) == {"email_address": "user@example.com"}


def test_trigger_customer_journey_logs_and_raises_on_failure(monkeypatch: Any) -> None:
    monkeypatch.setattr(mailchimp, "_api_key_cache", "fake-key-us12")
    monkeypatch.setenv("MAILCHIMP_SERVER_PREFIX", "us12")
    monkeypatch.setattr(
        mailchimp,
        "http_invoke",
        lambda **_k: {
            "status": 400,
            "body": '{"title":"Bad Request","detail":"Journey is not sending"}',
        },
    )
    recorded: list[tuple[str, dict[str, Any]]] = []

    def capture_warning(msg: str, *, extra: dict[str, Any] | None = None, **_kw: Any) -> None:
        recorded.append((msg, extra or {}))

    monkeypatch.setattr(mailchimp.logger, "warning", capture_warning)

    with pytest.raises(mailchimp.MailchimpApiError):
        mailchimp.trigger_customer_journey(
            email="a@example.com",
            journey_id="1",
            step_id="2",
        )

    assert recorded[0][0] == "Mailchimp journey trigger failed"
    assert recorded[0][1].get("mailchimp_step") == "trigger_journey"
    assert "Journey is not sending" in recorded[0][1].get("mailchimp_error_body", "")


def test_mailchimp_truncates_long_error_body_in_logs(monkeypatch: Any) -> None:
    monkeypatch.setattr(mailchimp, "_api_key_cache", "fake-key-us12")
    monkeypatch.setenv("MAILCHIMP_LIST_ID", "list1")
    monkeypatch.setenv("MAILCHIMP_SERVER_PREFIX", "us12")
    long_body = "x" * 3000

    monkeypatch.setattr(
        mailchimp,
        "http_invoke",
        lambda **_k: {"status": 500, "body": long_body},
    )
    recorded: list[dict[str, Any]] = []

    def capture_warning(_msg: str, *, extra: dict[str, Any] | None = None, **_kw: Any) -> None:
        recorded.append(extra or {})

    monkeypatch.setattr(mailchimp.logger, "warning", capture_warning)

    with pytest.raises(mailchimp.MailchimpApiError):
        mailchimp.add_subscriber_with_tag(
            email="a@example.com",
            first_name="A",
            tag_name="tag-one",
        )

    body = recorded[0].get("mailchimp_error_body", "")
    assert body.endswith("...(truncated)")
    assert len(body) < len(long_body)
