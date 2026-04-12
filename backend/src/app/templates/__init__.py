"""Email templates for the application."""

from app.templates.media_lead import (
    build_sales_notification_template_data,
    render_sales_notification_email,
)
from app.templates.types import EmailContent

__all__ = [
    "EmailContent",
    "build_sales_notification_template_data",
    "render_sales_notification_email",
]
