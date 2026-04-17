"""Meta Ads — archive campaigns flagged as ACTIVE but whose stop_time is past.

Live write operation. Requires:
    EVOLVESPROUTS_META_SYSTEM_USER_ACCESS_TOKEN
    EVOLVESPROUTS_META_AD_ACCOUNT_ID

Usage (dry-run first, always):
    python3 scripts/apply/meta-archive-ended-campaigns.py --dry-run
    python3 scripts/apply/meta-archive-ended-campaigns.py --apply

Archives campaigns whose:
  * configured_status (API "status" field) == ACTIVE or PAUSED
  * stop_time is set and strictly in the past (UTC)

ARCHIVED is terminal for reporting tidiness; it does not delete the
campaign or its historic data.
"""

import argparse
import os
import sys
from datetime import datetime, timezone

import requests

BASE_URL = "https://graph.facebook.com/v21.0"


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
        timeout=30,
    )
    if resp.status_code >= 300:
        print(f"  !! {path} -> HTTP {resp.status_code}: {resp.text}")
        resp.raise_for_status()
    return resp.json()


def _list_campaigns(account_id):
    return _get(
        f"{account_id}/campaigns",
        {
            "fields": "id,name,status,stop_time",
            "limit": 200,
        },
    ).get("data", [])


def _needs_archive(campaign, now_utc):
    status = campaign.get("status")
    stop_time_raw = campaign.get("stop_time")
    if status not in ("ACTIVE", "PAUSED"):
        return False
    if not stop_time_raw:
        return False
    try:
        stop_time_dt = datetime.fromisoformat(stop_time_raw)
    except (TypeError, ValueError):
        return False
    if stop_time_dt.tzinfo is None:
        stop_time_dt = stop_time_dt.replace(tzinfo=timezone.utc)
    return stop_time_dt < now_utc


def main():
    parser = argparse.ArgumentParser(description=__doc__ or "")
    parser.add_argument("--apply", action="store_true", help="Actually archive.")
    parser.add_argument("--dry-run", action="store_true", default=True)
    args = parser.parse_args()
    apply_changes = args.apply

    account_id = os.environ.get("EVOLVESPROUTS_META_AD_ACCOUNT_ID", "")
    if not account_id:
        sys.exit("EVOLVESPROUTS_META_AD_ACCOUNT_ID not set")

    print(f"Meta ad account: {account_id}")
    print(f"Mode: {'APPLY' if apply_changes else 'DRY-RUN'}\n")

    campaigns = _list_campaigns(account_id)
    now_utc = datetime.now(timezone.utc)
    targets = [c for c in campaigns if _needs_archive(c, now_utc)]

    if not targets:
        print("No ACTIVE/PAUSED campaigns with a past stop_time. Nothing to archive.")
        return

    print(f"Found {len(targets)} campaigns to archive:")
    for c in targets:
        print(f"  - {c['id']}  {c['name']}  (status={c['status']}, stop_time={c.get('stop_time')})")

    if not apply_changes:
        print("\nDry-run only. Re-run with --apply to archive.")
        return

    print()
    for c in targets:
        print(f"  Archiving {c['id']} ({c['name']})...", end=" ", flush=True)
        _post(c["id"], {"status": "ARCHIVED"})
        print("ok")

    print("\nDone.")


if __name__ == "__main__":
    main()
