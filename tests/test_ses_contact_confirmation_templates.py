from __future__ import annotations

from app.templates.ses.contact_confirmation import get_ses_template_definitions


def test_contact_confirmation_en_header_title() -> None:
    definitions = get_ses_template_definitions()
    en = next(t for t in definitions if t["TemplateName"].endswith("-en"))
    assert "YOUR MESSAGE IS IN SAFE HANDS!" in en["HtmlPart"]
