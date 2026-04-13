from __future__ import annotations

from app.templates.ses.media_download_link import get_ses_template_definitions


def test_media_download_ses_templates_preserve_handlebars_placeholders() -> None:
    definitions = get_ses_template_definitions()
    assert len(definitions) == 3
    en = next(t for t in definitions if t["TemplateName"].endswith("-en"))
    assert "YOUR FREE GUIDE IS HERE!" in en["HtmlPart"]
    assert "Download your free guide" in en["HtmlPart"]
    btn_para_start = en["HtmlPart"].index("Download your free guide")
    btn_para_snippet = en["HtmlPart"][max(0, btn_para_start - 120) : btn_para_start]
    assert "text-align:center" not in btn_para_snippet
    assert "{{first_name}}" in en["HtmlPart"]
    assert "{{download_url}}" in en["HtmlPart"]
    assert "{{my_best_auntie_url}}" in en["HtmlPart"]
    assert "{{free_intro_call_url}}" in en["HtmlPart"]
    assert "What you'll find inside" in en["HtmlPart"]
    assert "Want hands-on support?" in en["HtmlPart"]
    assert "{{my_best_auntie_url}}" in en["TextPart"]
    assert "{{free_intro_call_url}}" in en["TextPart"]
