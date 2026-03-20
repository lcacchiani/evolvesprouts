"""GA4 Admin API: Create remarketing audiences.

Creates three audiences for remarketing:
  1. Course Page Visitors (90-day, for Google Ads remarketing)
  2. Booking Intent - Did Not Complete (30-day, high-intent)
  3. High-Engagement Visitors (90-day, seed for Meta Lookalike)

Requires temporary Editor access on the GA4 property. After running,
revoke back to Viewer.

Required environment variables:
    EVOLVESPROUTS_GA4_PROPERTY_ID               GA4 property ID
    EVOLVESPROUTS_GOOGLE_SERVICE_ACCOUNT_JSON    Service account credentials
    EVOLVESPROUTS_GOOGLE_CLIENT_EMAIL            Service account email

Prerequisites:
    1. Grant Editor access to the service account:
       GA4 Admin > Property Access Management > find the service account
       > change role to Editor
    2. Run this script
    3. Revoke back to Viewer

Usage:
    python3 ga4-create-audiences.py
"""

import os
import sys
import tempfile

from google.analytics.admin_v1alpha import AnalyticsAdminServiceClient
from google.analytics.admin_v1alpha.types import (
    Audience,
    AudienceFilterClause,
    AudienceFilterExpression,
    AudienceFilterExpressionList,
    AudienceSimpleFilter,
    AudienceEventFilter,
    AudienceDimensionOrMetricFilter,
    AudienceFilterScope,
)
from google.api_core import exceptions as api_exceptions
from google.oauth2 import service_account

ACROSS = AudienceFilterScope.AUDIENCE_FILTER_SCOPE_ACROSS_ALL_SESSIONS
CONTAINS = AudienceDimensionOrMetricFilter.StringFilter.MatchType.CONTAINS


def _client():
    sa_json = os.environ.get("EVOLVESPROUTS_GOOGLE_SERVICE_ACCOUNT_JSON", "")
    if not sa_json:
        sys.exit("Missing EVOLVESPROUTS_GOOGLE_SERVICE_ACCOUNT_JSON")
    f = tempfile.NamedTemporaryFile(mode="w", suffix=".json", delete=False)
    f.write(sa_json)
    f.close()
    creds = service_account.Credentials.from_service_account_file(
        f.name, scopes=["https://www.googleapis.com/auth/analytics.edit"]
    )
    return AnalyticsAdminServiceClient(credentials=creds)


def _or_wrap(expr):
    return AudienceFilterExpression(
        or_group=AudienceFilterExpressionList(filter_expressions=[expr])
    )


def _event(name):
    return _or_wrap(
        AudienceFilterExpression(event_filter=AudienceEventFilter(event_name=name))
    )


def _dim_contains(field, value):
    return _or_wrap(
        AudienceFilterExpression(
            dimension_or_metric_filter=AudienceDimensionOrMetricFilter(
                field_name=field,
                string_filter=AudienceDimensionOrMetricFilter.StringFilter(
                    match_type=CONTAINS, value=value
                ),
            )
        )
    )


def _include(*expressions):
    return AudienceFilterClause(
        clause_type=AudienceFilterClause.AudienceClauseType.INCLUDE,
        simple_filter=AudienceSimpleFilter(
            scope=ACROSS,
            filter_expression=AudienceFilterExpression(
                and_group=AudienceFilterExpressionList(
                    filter_expressions=list(expressions)
                )
            ),
        ),
    )


def _exclude(*expressions):
    return AudienceFilterClause(
        clause_type=AudienceFilterClause.AudienceClauseType.EXCLUDE,
        simple_filter=AudienceSimpleFilter(
            scope=ACROSS,
            filter_expression=AudienceFilterExpression(
                and_group=AudienceFilterExpressionList(
                    filter_expressions=list(expressions)
                )
            ),
        ),
    )


AUDIENCES = [
    Audience(
        display_name="Course Page Visitors",
        description=(
            "Users who viewed the My Best Auntie training course page. "
            "90-day window. For Google Ads remarketing."
        ),
        membership_duration_days=90,
        filter_clauses=[
            _include(
                _event("page_view"),
                _dim_contains("unifiedPageScreen", "my-best-auntie-training-course"),
            ),
        ],
    ),
    Audience(
        display_name="Booking Intent - Did Not Complete",
        description="Opened booking modal but did not book. 30-day. High-intent remarketing.",
        membership_duration_days=30,
        filter_clauses=[
            _include(_event("booking_modal_open")),
            _exclude(_event("booking_submit_success")),
        ],
    ),
    Audience(
        display_name="High-Engagement Visitors",
        description="Engaged sessions (10+ seconds). 90-day. Seed for Meta Lookalike.",
        membership_duration_days=90,
        filter_clauses=[
            _include(_event("user_engagement")),
        ],
    ),
]


def main():
    property_id = os.environ.get("EVOLVESPROUTS_GA4_PROPERTY_ID", "")
    if not property_id:
        sys.exit("Missing EVOLVESPROUTS_GA4_PROPERTY_ID")

    client = _client()
    parent = f"properties/{property_id}"
    sa_email = os.environ.get("EVOLVESPROUTS_GOOGLE_CLIENT_EMAIL", "unknown")

    print(f"GA4 Property: {property_id}")
    print(f"Service account: {sa_email}\n")

    existing = {}
    try:
        for a in client.list_audiences(parent=parent):
            existing[a.display_name] = a.name
            print(f"  Existing: {a.display_name}")
    except api_exceptions.PermissionDenied:
        print("  Cannot list audiences — check property access.")
        sys.exit(1)

    print()
    created = 0
    for audience in AUDIENCES:
        name = audience.display_name
        if name in existing:
            print(f"  '{name}' — already exists, skipping.")
            created += 1
            continue
        try:
            result = client.create_audience(parent=parent, audience=audience)
            print(f"  '{result.display_name}' — created ({result.name})")
            created += 1
        except api_exceptions.PermissionDenied:
            print(f"  '{name}' — PERMISSION DENIED")
            print(f"\n  The service account needs Editor role on GA4 property.")
            print(f"  Go to: GA4 Admin > Property Access Management")
            print(f"  Find: {sa_email}")
            print(f"  Change: Viewer -> Editor")
            print(f"  Then re-run this script and revoke back to Viewer.")
            sys.exit(1)
        except api_exceptions.InvalidArgument as e:
            print(f"  '{name}' — invalid: {e.message}")
        except Exception as e:
            print(f"  '{name}' — error: {e}")

    print(f"\nDone: {created}/{len(AUDIENCES)} audiences ready.")
    if created == len(AUDIENCES):
        print("All audiences created. Remember to revoke Editor access.")


if __name__ == "__main__":
    main()
