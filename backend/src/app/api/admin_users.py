"""Admin users API handlers."""

from __future__ import annotations

import os
from collections.abc import Mapping
from typing import Any

from app.api.assets.assets_common import split_route_parts
from app.exceptions import ValidationError
from app.services import aws_proxy
from app.utils import json_response


def handle_admin_users_request(
    event: Mapping[str, Any],
    method: str,
    path: str,
) -> dict[str, Any]:
    """Handle /v1/admin/users routes."""
    parts = split_route_parts(path)
    if len(parts) != 2 or parts[0] != "admin" or parts[1] != "users":
        return json_response(404, {"error": "Not found"}, event=event)
    if method != "GET":
        return json_response(405, {"error": "Method not allowed"}, event=event)
    return _list_admin_users(event)


def _list_admin_users(event: Mapping[str, Any]) -> dict[str, Any]:
    user_pool_id = os.getenv("COGNITO_USER_POOL_ID")
    if not user_pool_id:
        raise ValidationError(
            "COGNITO_USER_POOL_ID is not configured",
            field="COGNITO_USER_POOL_ID",
        )

    group_name = os.getenv("ADMIN_GROUP", "admin").strip() or "admin"
    users: list[dict[str, Any]] = []
    next_token: str | None = None

    while True:
        params: dict[str, Any] = {
            "UserPoolId": user_pool_id,
            "GroupName": group_name,
            "Limit": 60,
        }
        if next_token:
            params["NextToken"] = next_token
        response = aws_proxy.invoke("cognito-idp", "list_users_in_group", params)
        for user in response.get("Users", []):
            attrs = user.get("Attributes", [])
            sub = _extract_cognito_attribute(attrs, "sub")
            if not sub:
                continue
            users.append(
                {
                    "sub": sub,
                    "email": _extract_cognito_attribute(attrs, "email"),
                    "name": _extract_cognito_attribute(attrs, "name"),
                }
            )
        next_token = response.get("NextToken")
        if not next_token:
            break

    return json_response(200, {"items": users}, event=event)


def _extract_cognito_attribute(attributes: Any, key: str) -> str | None:
    if not isinstance(attributes, list):
        return None
    for item in attributes:
        if not isinstance(item, Mapping):
            continue
        if item.get("Name") != key:
            continue
        value = item.get("Value")
        if isinstance(value, str):
            return value
    return None
