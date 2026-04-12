"""Shared HTML shell for SES transactional templates.

Plain-text (`TextPart`) bodies stay defined per template module: copy, placeholders,
and Handlebars blocks differ, so there is no meaningful shared wrapper beyond
optional repeated sign-off lines (already kept minimal in each template).
"""

from __future__ import annotations


def wrap_transactional_html(*, header_subtitle: str, inner_html: str) -> str:
    """Return a full HTML document wrapping `inner_html` in the standard Evolve Sprouts layout."""
    return f"""<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"/><meta name="viewport" content="width=device-width"/></head>
<body style="margin:0;padding:0;background-color:#f6f6f6;font-family:Arial,Helvetica,sans-serif;">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color:#f6f6f6;">
<tr><td align="center" style="padding:24px 12px;">
<table role="presentation" width="600" cellspacing="0" cellpadding="0"
style="max-width:600px;width:100%;background:#ffffff;border-radius:12px;overflow:hidden;">
<tr><td style="padding:24px 28px;background:#1a5f4a;color:#ffffff;">
<h1 style="margin:0;font-size:22px;line-height:1.3;">Evolve Sprouts</h1>
<p style="margin:8px 0 0;font-size:14px;opacity:0.95;">{header_subtitle}</p>
</td></tr>
<tr><td style="padding:28px;color:#333333;font-size:15px;line-height:1.6;">
{inner_html}
</td></tr>
<tr><td style="padding:16px 28px 24px;color:#666666;font-size:12px;line-height:1.5;">
<p style="margin:0;">Evolve Sprouts</p>
</td></tr>
</table></td></tr></table></body></html>"""
