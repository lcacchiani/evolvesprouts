from __future__ import annotations

from app.templates.media_lead import render_sales_notification_email


def test_render_sales_notification_email_includes_full_email() -> None:
    email_content = render_sales_notification_email(
        first_name="Ida",
        email="ida.parent@example.com",
        media_name="4 Ways to Teach Patience to Young Children",
        submitted_at="2026-03-01T00:00:00+00:00",
    )

    assert "ida.parent@example.com" in email_content.body_text
    assert "ida.parent@example.com" in (email_content.body_html or "")
    assert "***@***" not in email_content.body_text
