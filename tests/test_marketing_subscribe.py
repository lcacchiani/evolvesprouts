from __future__ import annotations

from typing import Any
from unittest.mock import MagicMock

from app.services import marketing_subscribe as ms
from app.services.mailchimp import add_subscriber_with_tag


def test_subscribe_to_marketing_skips_empty_email(monkeypatch: Any) -> None:
    logger = MagicMock()
    monkeypatch.setattr(ms, "run_with_retry", MagicMock())
    assert ms.subscribe_to_marketing(
        email="",
        first_name="A",
        tag_name="t",
        logger=logger,
    ) is False
    ms.run_with_retry.assert_not_called()


def test_subscribe_to_marketing_skips_journey_when_ids_empty(
    monkeypatch: Any,
) -> None:
    logger = MagicMock()
    monkeypatch.setenv("MAILCHIMP_WELCOME_JOURNEY_ID", "")
    monkeypatch.setenv("MAILCHIMP_WELCOME_JOURNEY_STEP_ID", "")
    calls: list[str] = []

    def _fake_run_with_retry(fn: Any, *args: Any, **kwargs: Any) -> Any:
        calls.append(getattr(fn, "__name__", "op"))
        if fn is add_subscriber_with_tag:
            return {"id": "m1"}
        raise AssertionError("unexpected call")

    monkeypatch.setattr(ms, "run_with_retry", _fake_run_with_retry)
    assert (
        ms.subscribe_to_marketing(
            email="a@example.com",
            first_name="Ada",
            tag_name="public-www-contact-inquiry",
            logger=logger,
        )
        is True
    )
    assert calls == ["add_subscriber_with_tag"]


def test_subscribe_to_marketing_skips_member_when_subscribe_member_false(
    monkeypatch: Any,
) -> None:
    logger = MagicMock()
    monkeypatch.setenv("MAILCHIMP_WELCOME_JOURNEY_ID", "j1")
    monkeypatch.setenv("MAILCHIMP_WELCOME_JOURNEY_STEP_ID", "s1")
    calls: list[Any] = []

    def _fake_run_with_retry(fn: Any, *args: Any, **kwargs: Any) -> Any:
        calls.append(fn)
        if fn.__name__ == "trigger_customer_journey":
            return None
        raise AssertionError(f"unexpected fn {fn}")

    monkeypatch.setattr(ms, "run_with_retry", _fake_run_with_retry)
    assert (
        ms.subscribe_to_marketing(
            email="a@example.com",
            first_name="Ada",
            tag_name="t",
            logger=logger,
            subscribe_member=False,
        )
        is True
    )
    assert len(calls) == 1
    assert calls[0].__name__ == "trigger_customer_journey"
