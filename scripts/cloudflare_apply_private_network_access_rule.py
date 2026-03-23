#!/usr/bin/env python3
"""Upsert a Cloudflare response header transform rule for Chromium Private Network Access (PNA).

Sets Access-Control-Allow-Private-Network: true on responses matching the rule
expression (typically your API hostname(s)). Requires the API DNS record to be
**proxied** (orange cloud); grey-cloud DNS-only records never hit Cloudflare edge.

Environment:
  CLOUDFLARE_RULESETS_API_TOKEN (optional): use for Rulesets/Transform Rules; if unset,
    CLOUDFLARE_API_TOKEN is used (must include Zone Transform Rules Edit, not DNS-only)
  CLOUDFLARE_API_TOKEN (required if RULESETS token not set)
  CLOUDFLARE_ZONE_ID (optional): zone id; if unset, set CLOUDFLARE_ZONE_NAME instead
  CLOUDFLARE_ZONE_NAME (optional): e.g. evolvesprouts.com — resolved via Zones API
  CLOUDFLARE_PNA_HTTP_HOSTS: comma-separated hostnames (e.g. api.example.com)
  CLOUDFLARE_PNA_RULE_EXPRESSION (optional): full Ruleset expression; overrides hosts

Usage:
  python3 scripts/cloudflare_apply_private_network_access_rule.py
  python3 scripts/cloudflare_apply_private_network_access_rule.py --dry-run

API token needs at least: Zone > Transform Rules > Edit (and related Rulesets read).
See: https://developers.cloudflare.com/rules/transform/response-header-modification/create-api/
"""

from __future__ import annotations

import argparse
import json
import os
import re
import sys
import urllib.error
import urllib.parse
import urllib.request
from typing import Any

API_BASE = "https://api.cloudflare.com/client/v4"
PHASE = "http_response_headers_transform"
RULE_REF = "evolvesprouts_chromium_pna_allow_private_network"
RULE_DESCRIPTION = (
    "Evolve Sprouts: Access-Control-Allow-Private-Network for Chromium PNA (CORS)"
)
HOSTNAME_RE = re.compile(r"^[a-zA-Z0-9]([a-zA-Z0-9.-]*[a-zA-Z0-9])?$")


def _request(
    method: str,
    url: str,
    token: str,
    body: dict[str, Any] | None = None,
    *,
    allow_status: frozenset[int] | None = None,
) -> dict[str, Any] | None:
    data = None if body is None else json.dumps(body).encode("utf-8")
    req = urllib.request.Request(
        url,
        data=data,
        method=method,
        headers={
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json",
        },
    )
    try:
        with urllib.request.urlopen(req, timeout=60) as resp:
            raw = resp.read().decode("utf-8")
    except urllib.error.HTTPError as exc:
        if allow_status is not None and exc.code in allow_status:
            return None
        err_body = exc.read().decode("utf-8", errors="replace")
        hint = ""
        if exc.code == 403 and "/rulesets" in url:
            hint = (
                " Token likely lacks Rulesets/Transform Rules scope (DNS-only tokens "
                "return 403). Create an API token with Zone > Transform Rules > Edit "
                "(and Rules read) and set CLOUDFLARE_RULESETS_API_TOKEN, or widen "
                "CLOUDFLARE_API_TOKEN."
            )
        raise RuntimeError(
            f"Cloudflare API HTTP {exc.code} for {method} {url}: {err_body}{hint}"
        ) from exc
    return json.loads(raw)


def _parse_hosts(raw: str) -> list[str]:
    hosts = [h.strip().lower() for h in raw.split(",") if h.strip()]
    for h in hosts:
        if not HOSTNAME_RE.match(h):
            raise ValueError(f"Invalid hostname in CLOUDFLARE_PNA_HTTP_HOSTS: {h!r}")
    return hosts


def _build_expression(hosts: list[str]) -> str:
    if not hosts:
        raise ValueError("No hostnames provided")
    parts = [f'(http.host eq "{h}")' for h in hosts]
    if len(parts) == 1:
        return parts[0]
    return "(" + " or ".join(parts) + ")"


def _rule_payload(expression: str) -> dict[str, Any]:
    return {
        "ref": RULE_REF,
        "description": RULE_DESCRIPTION,
        "expression": expression,
        "enabled": True,
        "action": "rewrite",
        "action_parameters": {
            "headers": {
                "access-control-allow-private-network": {
                    "operation": "set",
                    "value": "true",
                }
            }
        },
    }


def _resolve_zone_id_by_name(token: str, zone_name: str) -> str:
    q = urllib.parse.urlencode({"name": zone_name.strip()})
    url = f"{API_BASE}/zones?{q}"
    out = _request("GET", url, token)
    if out is None or not out.get("success"):
        raise RuntimeError(f"Could not list zones: {out}")
    results = out.get("result") or []
    if not results:
        raise RuntimeError(f"No Cloudflare zone named {zone_name!r}")
    return str(results[0]["id"])


def _get_entrypoint(token: str, zone_id: str) -> dict[str, Any] | None:
    url = f"{API_BASE}/zones/{zone_id}/rulesets/phases/{PHASE}/entrypoint"
    out = _request("GET", url, token, allow_status=frozenset({404}))
    if out is None:
        return None
    if not out.get("success"):
        raise RuntimeError(f"Cloudflare GET entrypoint failed: {out.get('errors')}")
    return out.get("result")


def _create_ruleset(token: str, zone_id: str, rule: dict[str, Any]) -> dict[str, Any]:
    url = f"{API_BASE}/zones/{zone_id}/rulesets"
    body = {
        "name": "Zone-level Response Headers Transform Ruleset",
        "kind": "zone",
        "phase": PHASE,
        "rules": [rule],
    }
    out = _request("POST", url, token, body)
    if out is None:
        raise RuntimeError("Unexpected empty response creating ruleset")
    if not out.get("success"):
        raise RuntimeError(f"Create ruleset failed: {out.get('errors')}")
    return out["result"]


def _post_rule(token: str, zone_id: str, ruleset_id: str, rule: dict[str, Any]) -> None:
    url = f"{API_BASE}/zones/{zone_id}/rulesets/{ruleset_id}/rules"
    out = _request("POST", url, token, rule)
    if out is None or not out.get("success"):
        raise RuntimeError(f"POST rule failed: {out.get('errors') if out else 'empty'}")


def _patch_rule(
    token: str,
    zone_id: str,
    ruleset_id: str,
    rule_id: str,
    rule: dict[str, Any],
) -> None:
    url = f"{API_BASE}/zones/{zone_id}/rulesets/{ruleset_id}/rules/{rule_id}"
    out = _request("PATCH", url, token, rule)
    if out is None or not out.get("success"):
        raise RuntimeError(f"PATCH rule failed: {out.get('errors') if out else 'empty'}")


def upsert_rule(token: str, zone_id: str, expression: str, dry_run: bool) -> None:
    rule = _rule_payload(expression)
    if dry_run:
        print(json.dumps(rule, indent=2))
        return

    result = _get_entrypoint(token, zone_id)
    if result is None:
        try:
            created = _create_ruleset(token, zone_id, rule)
            print(
                "Created zone ruleset for http_response_headers_transform "
                f"(id={created.get('id')}).",
                file=sys.stderr,
            )
            return
        except RuntimeError:
            result = _get_entrypoint(token, zone_id)
            if result is None:
                raise RuntimeError(
                    "Could not create or load http_response_headers_transform ruleset"
                ) from None

    ruleset_id = result["id"]
    rules = result.get("rules") or []
    existing = [r for r in rules if isinstance(r, dict) and r.get("ref") == RULE_REF]
    if existing:
        rid = existing[0].get("id")
        if not rid:
            raise RuntimeError("Existing rule missing id")
        _patch_rule(token, zone_id, ruleset_id, rid, rule)
        print(f"Updated rule {rid} on ruleset {ruleset_id}.", file=sys.stderr)
    else:
        _post_rule(token, zone_id, ruleset_id, rule)
        print(f"Appended rule to ruleset {ruleset_id}.", file=sys.stderr)


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Print rule JSON only; do not call the API.",
    )
    args = parser.parse_args()

    token = (
        os.environ.get("CLOUDFLARE_RULESETS_API_TOKEN", "").strip()
        or os.environ.get("CLOUDFLARE_API_TOKEN", "").strip()
    )
    zone_id = os.environ.get("CLOUDFLARE_ZONE_ID", "").strip()
    zone_name = os.environ.get("CLOUDFLARE_ZONE_NAME", "").strip()
    if not args.dry_run:
        if not token:
            print(
                "CLOUDFLARE_API_TOKEN or CLOUDFLARE_RULESETS_API_TOKEN is required.",
                file=sys.stderr,
            )
            return 1
        if not zone_id:
            if zone_name:
                zone_id = _resolve_zone_id_by_name(token, zone_name)
            else:
                print(
                    "Set CLOUDFLARE_ZONE_ID or CLOUDFLARE_ZONE_NAME.",
                    file=sys.stderr,
                )
                return 1

    expr_override = os.environ.get("CLOUDFLARE_PNA_RULE_EXPRESSION", "").strip()
    hosts_raw = os.environ.get("CLOUDFLARE_PNA_HTTP_HOSTS", "").strip()
    if expr_override:
        expression = expr_override
    elif hosts_raw:
        expression = _build_expression(_parse_hosts(hosts_raw))
    else:
        print(
            "Set CLOUDFLARE_PNA_HTTP_HOSTS (comma-separated) or "
            "CLOUDFLARE_PNA_RULE_EXPRESSION.",
            file=sys.stderr,
        )
        return 1

    try:
        upsert_rule(token, zone_id, expression, args.dry_run)
    except (OSError, RuntimeError, ValueError) as exc:
        print(exc, file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
