"""Media lead notification email templates."""

from __future__ import annotations

from app.templates.types import EmailContent

SUBJECT_TEMPLATE = "[Evolve Sprouts] New Media Lead: {first_name}"

TEXT_TEMPLATE = """
[Evolve Sprouts] New Media Lead

First Name: {first_name}
Email: {email}
Media: {media_name}
Submitted At: {submitted_at}

Please follow up with this lead in CRM.
"""

HTML_TEMPLATE = """
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
    <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
        <h2 style="margin: 0 0 10px 0; color: #1a1a1a;">[Evolve Sprouts] New Media Lead</h2>
        <p style="margin: 0; font-size: 14px; color: #666;">
            Lead Name: <strong>{first_name}</strong>
        </p>
    </div>

    <p style="margin-bottom: 20px;">A new media lead was captured from the public website.</p>

    <table style="border-collapse: collapse; width: 100%; margin-bottom: 20px;">
        <tr>
            <td style="padding: 12px; border: 1px solid #dee2e6; font-weight: bold; background-color: #f8f9fa; width: 160px;">
                First Name
            </td>
            <td style="padding: 12px; border: 1px solid #dee2e6;">
                {first_name}
            </td>
        </tr>
        <tr>
            <td style="padding: 12px; border: 1px solid #dee2e6; font-weight: bold; background-color: #f8f9fa;">
                Email
            </td>
            <td style="padding: 12px; border: 1px solid #dee2e6;">
                {email}
            </td>
        </tr>
        <tr>
            <td style="padding: 12px; border: 1px solid #dee2e6; font-weight: bold; background-color: #f8f9fa;">
                Media
            </td>
            <td style="padding: 12px; border: 1px solid #dee2e6;">
                {media_name}
            </td>
        </tr>
        <tr>
            <td style="padding: 12px; border: 1px solid #dee2e6; font-weight: bold; background-color: #f8f9fa;">
                Submitted At
            </td>
            <td style="padding: 12px; border: 1px solid #dee2e6;">
                {submitted_at}
            </td>
        </tr>
    </table>

    <div style="background-color: #e7f3ff; padding: 15px; border-radius: 5px; border-left: 4px solid #0066cc;">
        <p style="margin: 0; font-size: 14px;">
            Please review and follow up with this lead in the CRM workflow.
        </p>
    </div>

    <hr style="border: none; border-top: 1px solid #dee2e6; margin: 30px 0;">

    <p style="font-size: 12px; color: #666; margin: 0;">
        This is an automated message from Evolve Sprouts. Please do not reply directly to this email.
    </p>
</body>
</html>
"""


def build_sales_notification_template_data(
    *,
    first_name: str,
    email: str,
    media_name: str,
    submitted_at: str,
) -> dict[str, str]:
    """Build template data for a media sales notification."""
    return {
        "first_name": first_name,
        "email": email,
        "media_name": media_name,
        "submitted_at": submitted_at,
    }


def render_sales_notification_email(
    *,
    first_name: str,
    email: str,
    media_name: str,
    submitted_at: str,
) -> EmailContent:
    """Render media sales notification email content."""
    data = build_sales_notification_template_data(
        first_name=first_name,
        email=email,
        media_name=media_name,
        submitted_at=submitted_at,
    )
    return EmailContent(
        subject=SUBJECT_TEMPLATE.format(first_name=data["first_name"]),
        body_text=TEXT_TEMPLATE.format(**data).strip(),
        body_html=HTML_TEMPLATE.format(**data).strip(),
    )
