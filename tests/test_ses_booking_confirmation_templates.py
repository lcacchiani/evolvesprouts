from __future__ import annotations

from app.templates.ses.booking_confirmation import get_ses_template_definitions


def test_booking_ses_templates_preserve_handlebars_placeholders() -> None:
    definitions = get_ses_template_definitions()
    assert len(definitions) == 3
    en = next(t for t in definitions if t["TemplateName"].endswith("-en"))
    assert "{{course_label}}" in en["SubjectPart"]
    assert "{{service_row_label}}" in en["HtmlPart"]
    assert "{{service_row_label}}" in en["TextPart"]
    assert "{{full_name}}" in en["HtmlPart"]
    assert "{{#unless is_free}}" in en["HtmlPart"]
    assert "{{#if is_pending_payment}}" in en["HtmlPart"]
    assert "{{#if include_fps_instructions}}" in en["HtmlPart"]
    assert "{{#if schedule_datetime_label_html}}" in en["HtmlPart"]
    assert "{{{schedule_datetime_label_html}}}" in en["HtmlPart"]
    assert "{{#if schedule_datetime_plain_multiline}}" in en["TextPart"]
    assert "{{#if location_plain_multiline}}" in en["TextPart"]
    assert "{{{details_block_html}}}" in en["HtmlPart"]
    assert "{{#if location_block_html}}" in en["HtmlPart"]
    assert "{{{location_block_html}}}" in en["HtmlPart"]
    assert "<hr " in en["HtmlPart"]
    assert "We look forward to seeing you" in en["HtmlPart"]
    assert "{{faq_url}}" in en["HtmlPart"]
    assert "{{whatsapp_url}}" in en["HtmlPart"]
    assert "FAQ" in en["HtmlPart"]
    assert "{{whatsapp_url}}" in en["TextPart"]
    assert "{{#if location_plain}}" in en["TextPart"]
    assert "We look forward to seeing you" in en["TextPart"]
    assert "{{faq_url}}" in en["TextPart"]
