"""Assets API package."""

from app.api.assets.admin_assets import handle_admin_assets_request
from app.api.assets.public_assets import handle_public_assets_request
from app.api.assets.share_assets import handle_share_assets_request
from app.api.assets.user_assets import handle_user_assets_request

__all__ = [
    "handle_admin_assets_request",
    "handle_public_assets_request",
    "handle_share_assets_request",
    "handle_user_assets_request",
]
