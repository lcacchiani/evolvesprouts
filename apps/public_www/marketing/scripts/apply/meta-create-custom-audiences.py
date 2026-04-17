"""Meta Ads — create Custom Audiences via Marketing API.

Idempotent: skips audiences whose display name already exists on the
ad account.

Creates:
  1. All Website Visitors 180d           (pixel)
  2. Course Page Visitors 90d            (pixel, URL contains course slug)
  3. Easter Reel Viewers >=50% 180d     (video engagement)
  4. IC not Purchase 30d                 (pixel event rule)
  5. IG Account Engagers 365d            (Instagram business account engagement)
  6. FB Page Engagers 365d               (Facebook page engagement)

Required env vars:
    EVOLVESPROUTS_META_SYSTEM_USER_ACCESS_TOKEN
    EVOLVESPROUTS_META_AD_ACCOUNT_ID
    EVOLVESPROUTS_META_PAGE_ID
    EVOLVESPROUTS_META_INSTAGRAM_BUSINESS_ACCOUNT_ID

Hardcoded (from the 2026-04-17 account state; update if changed):
    PIXEL_ID                               1390603692257252
    EASTER_REEL_VIDEO_ID                   2025929855017285

Usage:
    python3 scripts/apply/meta-create-custom-audiences.py --dry-run
    python3 scripts/apply/meta-create-custom-audiences.py --apply
"""

import argparse
import json
import os
import sys

import requests

BASE_URL = "https://graph.facebook.com/v21.0"
PIXEL_ID = "1390603692257252"
EASTER_REEL_VIDEO_ID = "2025929855017285"
COURSE_URL_FRAGMENT = "my-best-auntie-training-course"


def _token():
    token = os.environ.get("EVOLVESPROUTS_META_SYSTEM_USER_ACCESS_TOKEN", "")
    if not token:
        sys.exit("EVOLVESPROUTS_META_SYSTEM_USER_ACCESS_TOKEN not set")
    return token


def _get(path, params=None):
    resp = requests.get(
        f"{BASE_URL}/{path}",
        params={**(params or {}), "access_token": _token()},
        timeout=30,
    )
    resp.raise_for_status()
    return resp.json()


def _post(path, data):
    resp = requests.post(
        f"{BASE_URL}/{path}",
        data={**data, "access_token": _token()},
        timeout=60,
    )
    if resp.status_code >= 300:
        print(f"  !! {path} -> HTTP {resp.status_code}: {resp.text}")
        resp.raise_for_status()
    return resp.json()


def _list_existing(account_id):
    out = {}
    after = None
    while True:
        params = {"fields": "id,name,subtype", "limit": 200}
        if after:
            params["after"] = after
        data = _get(f"{account_id}/customaudiences", params)
        for a in data.get("data", []):
            out[a["name"]] = a
        paging = data.get("paging", {}).get("cursors", {})
        after = paging.get("after")
        if not after or "next" not in data.get("paging", {}):
            break
    return out


def website_all_rule():
    # All URL pageviews on the pixel, 180d retention.
    return {
        "inclusions": {
            "operator": "or",
            "rules": [
                {
                    "event_sources": [
                        {"id": PIXEL_ID, "type": "pixel"},
                    ],
                    "retention_seconds": 180 * 24 * 3600,
                    "filter": {
                        "operator": "and",
                        "filters": [
                            {
                                "field": "event",
                                "operator": "eq",
                                "value": "PageView",
                            },
                        ],
                    },
                },
            ],
        },
    }


def website_course_rule():
    return {
        "inclusions": {
            "operator": "or",
            "rules": [
                {
                    "event_sources": [
                        {"id": PIXEL_ID, "type": "pixel"},
                    ],
                    "retention_seconds": 90 * 24 * 3600,
                    "filter": {
                        "operator": "and",
                        "filters": [
                            {
                                "field": "url",
                                "operator": "i_contains",
                                "value": COURSE_URL_FRAGMENT,
                            },
                        ],
                    },
                },
            ],
        },
    }


def ic_not_purchase_rule():
    return {
        "inclusions": {
            "operator": "or",
            "rules": [
                {
                    "event_sources": [{"id": PIXEL_ID, "type": "pixel"}],
                    "retention_seconds": 30 * 24 * 3600,
                    "filter": {
                        "operator": "and",
                        "filters": [
                            {
                                "field": "event",
                                "operator": "eq",
                                "value": "InitiateCheckout",
                            },
                        ],
                    },
                },
            ],
        },
        "exclusions": {
            "operator": "or",
            "rules": [
                {
                    "event_sources": [{"id": PIXEL_ID, "type": "pixel"}],
                    "retention_seconds": 30 * 24 * 3600,
                    "filter": {
                        "operator": "and",
                        "filters": [
                            {
                                "field": "event",
                                "operator": "eq",
                                "value": "Purchase",
                            },
                        ],
                    },
                },
            ],
        },
    }


def static_audience_payload(name, description, subtype, rule):
    # v21 no longer accepts the explicit `subtype` parameter; it is inferred
    # from the rule's `event_sources` type. Keep the label in the dry-run
    # output for clarity but strip it from the create payload.
    return {
        "_subtype_label": subtype,
        "name": name,
        "description": description,
        "customer_file_source": "USER_PROVIDED_ONLY",
        "rule": json.dumps(rule),
    }


def ig_engagers_payload():
    ig_id = os.environ.get("EVOLVESPROUTS_META_INSTAGRAM_BUSINESS_ACCOUNT_ID", "")
    if not ig_id:
        sys.exit("EVOLVESPROUTS_META_INSTAGRAM_BUSINESS_ACCOUNT_ID not set")
    engagement_rule = {
        "inclusions": {
            "operator": "or",
            "rules": [
                {
                    "event_sources": [
                        {"id": ig_id, "type": "ig_business"},
                    ],
                    "retention_seconds": 365 * 24 * 3600,
                    "filter": {
                        "operator": "and",
                        "filters": [
                            {
                                "field": "event",
                                "operator": "eq",
                                "value": "ig_business_profile_all",
                            },
                        ],
                    },
                },
            ],
        },
    }
    return {
        "_subtype_label": "ENGAGEMENT",
        "name": "IG Account Engagers 365d",
        "description": "People who engaged with the Instagram account in the last 365 days.",
        "rule": json.dumps(engagement_rule),
    }


def fb_engagers_payload():
    page_id = os.environ.get("EVOLVESPROUTS_META_PAGE_ID", "")
    if not page_id:
        sys.exit("EVOLVESPROUTS_META_PAGE_ID not set")
    engagement_rule = {
        "inclusions": {
            "operator": "or",
            "rules": [
                {
                    "event_sources": [
                        {"id": page_id, "type": "page"},
                    ],
                    "retention_seconds": 365 * 24 * 3600,
                    "filter": {
                        "operator": "and",
                        "filters": [
                            {
                                "field": "event",
                                "operator": "eq",
                                "value": "page_engaged",
                            },
                        ],
                    },
                },
            ],
        },
    }
    return {
        "_subtype_label": "ENGAGEMENT",
        "name": "FB Page Engagers 365d",
        "description": "People who engaged with the Facebook page in the last 365 days.",
        "rule": json.dumps(engagement_rule),
    }


def reel_viewers_payload():
    # Video engagement audience uses subtype ENGAGEMENT with a video rule.
    rule = {
        "inclusions": {
            "operator": "or",
            "rules": [
                {
                    "event_sources": [
                        {"id": EASTER_REEL_VIDEO_ID, "type": "video"},
                    ],
                    "retention_seconds": 180 * 24 * 3600,
                    "filter": {
                        "operator": "and",
                        "filters": [
                            {
                                "field": "event",
                                "operator": "eq",
                                "value": "video_view_50_pct",
                            },
                        ],
                    },
                },
            ],
        },
    }
    return {
        "_subtype_label": "ENGAGEMENT",
        "name": "Easter Reel Viewers >=50% 180d",
        "description": "People who watched >=50% of the Easter Workshop Reel in the last 180 days.",
        "rule": json.dumps(rule),
    }


def website_audience_payloads():
    return [
        static_audience_payload(
            "All Website Visitors 180d",
            "All PageView events from the pixel, 180d retention.",
            "WEBSITE",
            website_all_rule(),
        ),
        static_audience_payload(
            "Course Page Visitors 90d",
            "Visitors of /en/services/my-best-auntie-training-course, 90d retention.",
            "WEBSITE",
            website_course_rule(),
        ),
        static_audience_payload(
            "IC not Purchase 30d",
            "InitiateCheckout within 30d, excluding Purchase within 30d.",
            "WEBSITE",
            ic_not_purchase_rule(),
        ),
    ]


def all_payloads():
    return [
        *website_audience_payloads(),
        reel_viewers_payload(),
        ig_engagers_payload(),
        fb_engagers_payload(),
    ]


def main():
    parser = argparse.ArgumentParser(description=__doc__ or "")
    parser.add_argument("--apply", action="store_true")
    parser.add_argument("--dry-run", action="store_true", default=True)
    args = parser.parse_args()
    apply_changes = args.apply

    account_id = os.environ.get("EVOLVESPROUTS_META_AD_ACCOUNT_ID", "")
    if not account_id:
        sys.exit("EVOLVESPROUTS_META_AD_ACCOUNT_ID not set")

    print(f"Meta ad account: {account_id}")
    print(f"Mode: {'APPLY' if apply_changes else 'DRY-RUN'}\n")

    existing = _list_existing(account_id)
    print(f"Existing custom audiences: {len(existing)}")
    for name in sorted(existing):
        print(f"  - {name}")

    print("\nPlanned creations:")
    planned = all_payloads()
    for p in planned:
        marker = "SKIP (exists)" if p["name"] in existing else "create"
        print(f"  [{marker}] {p['name']}  (subtype={p['_subtype_label']})")

    if not apply_changes:
        print("\nDry-run only. Re-run with --apply to create.")
        return

    print()
    for p in planned:
        if p["name"] in existing:
            continue
        print(f"  Creating '{p['name']}'...", end=" ", flush=True)
        payload = {k: v for k, v in p.items() if not k.startswith("_")}
        res = _post(f"{account_id}/customaudiences", payload)
        print(f"id={res.get('id')}")

    print("\nDone.")


if __name__ == "__main__":
    main()
