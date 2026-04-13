"""Shared HTML shell for SES transactional templates.

Plain-text (`TextPart`) bodies stay defined per template module: copy, placeholders,
and Handlebars blocks differ, so there is no meaningful shared wrapper beyond
optional repeated sign-off lines (already kept minimal in each template).

The HTML shell expects ``template_data`` to include keys from
``build_transactional_template_shell_data`` (``logo_url``, ``site_home_url``,
``footer_block_html``, ``faq_url``, ``my_best_auntie_url``, ``free_intro_call_url``
where used) plus per-template fields. ``footer_block_html`` (thank-you, rule, optional social links, copyright line)
is pre-rendered HTML and must be bound with triple-brace Handlebars in the stored
template (``{{{footer_block_html}}}``) so SES does not escape markup.
"""

from __future__ import annotations

import html


def wrap_transactional_html(*, header_title: str, inner_html: str) -> str:
    """Return a full HTML document wrapping ``inner_html`` in the standard layout."""
    title_esc = html.escape(header_title)
    # Triple-brace Handlebars for unescaped HTML (not a Python f-string field).
    footer_unescaped = "{{{footer_block_html}}}"
    return f"""<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"/><meta name="viewport" content="width=device-width"/></head>
<body style="margin:0;padding:0;background-color:#f6f6f6;font-family:Arial,Helvetica,sans-serif;">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color:#f6f6f6;">
<tr><td align="center" style="padding:24px 12px;">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:600px;width:100%;">
<tr><td align="center" style="padding:0 0 20px 0;">
<a href="{{{{site_home_url}}}}" style="text-decoration:none;">
<img src="{{{{logo_url}}}}" width="200" alt="Evolve Sprouts" style="display:block;border:0;outline:none;height:auto;max-width:100%;"/>
</a>
</td></tr>
</table>
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:600px;width:100%;background:#ffffff;border-radius:12px;overflow:hidden;">
<tr><td style="padding:24px 28px;background:#C84A16;color:#ffffff;text-align:center;">
<h1 style="margin:0;font-size:22px;line-height:1.3;font-weight:700;">{title_esc}</h1>
</td></tr>
<tr><td style="padding:28px;color:#333333;font-size:15px;line-height:1.6;">
{inner_html}
</td></tr>
<tr><td style="padding:28px 28px 24px;color:#666666;font-size:12px;line-height:1.5;">
{footer_unescaped}
</td></tr>
</table>
</td></tr>
</table>
</body></html>"""
