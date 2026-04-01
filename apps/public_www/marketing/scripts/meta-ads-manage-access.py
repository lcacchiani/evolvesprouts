"""Manage external access to the Evolve Sprouts Meta ad account.

Grant, list, or revoke agency access for an external Meta Business Manager
so they can view ad performance analytics.

Required environment variables:
    EVOLVESPROUTS_META_SYSTEM_USER_ACCESS_TOKEN  System user access token
    EVOLVESPROUTS_META_AD_ACCOUNT_ID             Ad account ID (act_...)

Usage:
    # List current agencies with access
    python3 meta-ads-manage-access.py list

    # Grant read-only analytics access to an external business
    python3 meta-ads-manage-access.py grant <EXTERNAL_BUSINESS_ID>

    # Grant with additional permissions (advertise + analyze)
    python3 meta-ads-manage-access.py grant <EXTERNAL_BUSINESS_ID> --tasks ADVERTISE ANALYZE

    # Revoke access from an external business
    python3 meta-ads-manage-access.py revoke <EXTERNAL_BUSINESS_ID>
"""

import argparse
import os
import sys

import requests

BASE_URL = "https://graph.facebook.com/v21.0"

VALID_TASKS = {"MANAGE", "ADVERTISE", "ANALYZE"}


def _get_token():
    token = os.environ.get("EVOLVESPROUTS_META_SYSTEM_USER_ACCESS_TOKEN", "")
    if not token:
        sys.exit("Error: EVOLVESPROUTS_META_SYSTEM_USER_ACCESS_TOKEN not set")
    return token


def _get_ad_account():
    acct = os.environ.get("EVOLVESPROUTS_META_AD_ACCOUNT_ID", "")
    if not acct:
        sys.exit("Error: EVOLVESPROUTS_META_AD_ACCOUNT_ID not set")
    return acct


def _api_error(resp):
    """Extract a human-readable error from a failed API response."""
    try:
        body = resp.json()
        err = body.get("error", {})
        return f"{err.get('message', 'Unknown error')} (code {err.get('code', '?')})"
    except Exception:
        return f"HTTP {resp.status_code}"


def list_agencies(ad_account, token):
    """List all external businesses (agencies) with access to the ad account."""
    resp = requests.get(
        f"{BASE_URL}/{ad_account}/agencies",
        params={"access_token": token},
        timeout=30,
    )
    if resp.status_code != 200:
        sys.exit(f"Failed to list agencies: {_api_error(resp)}")

    data = resp.json()
    agencies = data.get("data", [])

    if not agencies:
        print("No external businesses currently have agency access.")
        return

    print(f"Agencies with access to {ad_account}:\n")
    for agency in agencies:
        print(f"  Business: {agency.get('name', 'N/A')}")
        print(f"    ID: {agency.get('id')}")
        tasks = agency.get("permitted_tasks", [])
        if tasks:
            print(f"    Permitted tasks: {', '.join(tasks)}")
        access_status = agency.get("access_status", "")
        if access_status:
            print(f"    Status: {access_status}")
        print()


def grant_access(ad_account, token, external_business_id, tasks):
    """Grant agency access to an external Meta Business."""
    print(f"Granting access to business {external_business_id}...")
    print(f"  Ad account: {ad_account}")
    print(f"  Tasks: {tasks}")
    print()

    resp = requests.post(
        f"{BASE_URL}/{ad_account}/agencies",
        data={
            "business": external_business_id,
            "permitted_tasks": str(tasks),
            "access_token": token,
        },
        timeout=30,
    )

    if resp.status_code != 200:
        sys.exit(f"Failed to grant access: {_api_error(resp)}")

    result = resp.json()
    if result.get("success"):
        print("Access granted successfully.")
        if result.get("requires_admin_approval"):
            print(
                "\nNote: An admin review is required before access takes effect."
                "\nApprove at: https://business.facebook.com/settings/requests/admin_reviews"
            )
    else:
        print(f"Unexpected response: {result}")


def revoke_access(ad_account, token, external_business_id):
    """Revoke agency access from an external Meta Business."""
    print(f"Revoking access from business {external_business_id}...")
    print(f"  Ad account: {ad_account}")
    print()

    resp = requests.delete(
        f"{BASE_URL}/{ad_account}/agencies",
        params={
            "business": external_business_id,
            "access_token": token,
        },
        timeout=30,
    )

    if resp.status_code != 200:
        sys.exit(f"Failed to revoke access: {_api_error(resp)}")

    result = resp.json()
    if result.get("success"):
        print("Access revoked successfully.")
    else:
        print(f"Unexpected response: {result}")


def main():
    parser = argparse.ArgumentParser(
        description="Manage external agency access to the Meta ad account.",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=(
            "examples:\n"
            "  python3 meta-ads-manage-access.py list\n"
            "  python3 meta-ads-manage-access.py grant 123456789\n"
            "  python3 meta-ads-manage-access.py grant 123456789 --tasks ADVERTISE ANALYZE\n"
            "  python3 meta-ads-manage-access.py revoke 123456789\n"
        ),
    )
    subparsers = parser.add_subparsers(dest="command", required=True)

    subparsers.add_parser("list", help="List agencies with access to the ad account")

    grant_parser = subparsers.add_parser(
        "grant", help="Grant agency access to an external business"
    )
    grant_parser.add_argument(
        "business_id",
        help="External Meta Business Manager ID to grant access to",
    )
    grant_parser.add_argument(
        "--tasks",
        nargs="+",
        choices=sorted(VALID_TASKS),
        default=["ANALYZE"],
        help="Permission tasks to grant (default: ANALYZE for read-only analytics)",
    )

    revoke_parser = subparsers.add_parser(
        "revoke", help="Revoke agency access from an external business"
    )
    revoke_parser.add_argument(
        "business_id",
        help="External Meta Business Manager ID to revoke access from",
    )

    args = parser.parse_args()

    token = _get_token()
    ad_account = _get_ad_account()

    if args.command == "list":
        list_agencies(ad_account, token)
    elif args.command == "grant":
        grant_access(ad_account, token, args.business_id, args.tasks)
    elif args.command == "revoke":
        revoke_access(ad_account, token, args.business_id)


if __name__ == "__main__":
    main()
