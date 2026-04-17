"""GA4 — mark key events.

Creates KeyEvent resources for taxonomy events we want counted as
conversions but that are currently not toggled on in GA4. Idempotent:
skips events already marked as key events.

Key events marked (in addition to the ones already configured):
  - booking_confirm_pay_click   (mid-funnel intent signal)
  - whatsapp_click              (lead-adjacent intent signal)

Pairs with:
  * analytics-taxonomy.json has ga4KeyEvent: true on booking_confirm_pay_click
  * Google Ads will auto-sync these as `(web) <event_name>` conversion
    actions within ~24h; follow up with
    google-ads-enable-secondary-conversions.py to promote HIDDEN -> ENABLED
    (Secondary).

Required env vars:
    EVOLVESPROUTS_GA4_PROPERTY_ID
    EVOLVESPROUTS_GOOGLE_SERVICE_ACCOUNT_JSON
    EVOLVESPROUTS_GOOGLE_CLIENT_EMAIL

Requires Editor access on the GA4 property for the service account.
Grant temporary Editor, run, revoke back to Viewer (documented in
apps/public_www/marketing/README.md).

Usage:
    python3 scripts/apply/ga4-mark-key-events.py --dry-run
    python3 scripts/apply/ga4-mark-key-events.py --apply
"""

import argparse
import os
import sys
import tempfile

from google.analytics.admin_v1alpha import AnalyticsAdminServiceClient
from google.analytics.admin_v1alpha.types import KeyEvent
from google.api_core import exceptions as api_exceptions
from google.oauth2 import service_account

TARGET_EVENT_NAMES = [
    "booking_confirm_pay_click",
    "whatsapp_click",
]


def _client():
    sa_json = os.environ.get("EVOLVESPROUTS_GOOGLE_SERVICE_ACCOUNT_JSON", "")
    if not sa_json:
        sys.exit("EVOLVESPROUTS_GOOGLE_SERVICE_ACCOUNT_JSON not set")
    f = tempfile.NamedTemporaryFile(mode="w", suffix=".json", delete=False)
    f.write(sa_json)
    f.close()
    creds = service_account.Credentials.from_service_account_file(
        f.name, scopes=["https://www.googleapis.com/auth/analytics.edit"]
    )
    return AnalyticsAdminServiceClient(credentials=creds)


def main():
    parser = argparse.ArgumentParser(description=__doc__ or "")
    parser.add_argument("--apply", action="store_true")
    parser.add_argument("--dry-run", action="store_true", default=True)
    args = parser.parse_args()
    apply_changes = args.apply

    property_id = os.environ.get("EVOLVESPROUTS_GA4_PROPERTY_ID", "")
    if not property_id:
        sys.exit("EVOLVESPROUTS_GA4_PROPERTY_ID not set")
    client = _client()
    parent = f"properties/{property_id}"

    print(f"Mode: {'APPLY' if apply_changes else 'DRY-RUN'}")
    print(f"Property: {property_id}\n")

    existing = {ke.event_name for ke in client.list_key_events(parent=parent)}
    to_create = []
    for name in TARGET_EVENT_NAMES:
        if name in existing:
            print(f"  skip (already key event): {name}")
        else:
            print(f"  create key event: {name}")
            to_create.append(name)

    if not to_create or not apply_changes:
        if not to_create:
            print("\nNothing to do.")
        else:
            print("\nDry-run only. Re-run with --apply to create.")
        return

    print()
    for name in to_create:
        try:
            res = client.create_key_event(
                parent=parent,
                key_event=KeyEvent(
                    event_name=name,
                    counting_method=KeyEvent.CountingMethod.ONCE_PER_EVENT,
                ),
            )
            print(f"  CREATED {res.event_name} -> {res.name}")
        except api_exceptions.AlreadyExists:
            print(f"  ALREADY_EXISTS {name}")
        except api_exceptions.PermissionDenied as e:
            sys.exit(
                "PERMISSION_DENIED. Ensure the service account "
                f"({os.environ.get('EVOLVESPROUTS_GOOGLE_CLIENT_EMAIL','?')}) "
                f"has Editor on property {property_id}. Detail: {e.message}"
            )

    print("\nDone.")


if __name__ == "__main__":
    main()
