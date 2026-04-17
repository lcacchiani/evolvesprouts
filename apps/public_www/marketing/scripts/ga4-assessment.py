"""GA4 website analytics assessment (read-only).

Queries the GA4 Data API for site overview, traffic sources, booking funnel
events, and landing page performance.

Required environment variables:
    EVOLVESPROUTS_GA4_PROPERTY_ID               GA4 property ID
    EVOLVESPROUTS_GOOGLE_SERVICE_ACCOUNT_JSON    Service account credentials JSON

Usage:
    python3 ga4-assessment.py [--out PATH]

`--out` mirrors stdout to the given file (raw plaintext). Intended to be
committed into `marketing/generated-reports/` (git-ignored) for later
reference when authoring the narrative markdown assessment.
"""

import argparse
import contextlib
import os
import sys
import tempfile

from google.analytics.data_v1beta import BetaAnalyticsDataClient
from google.analytics.data_v1beta.types import (
    DateRange,
    Dimension,
    Metric,
    RunReportRequest,
)
from google.oauth2 import service_account


class _Tee:
    """Minimal tee: write to every underlying stream."""

    def __init__(self, *streams):
        self._streams = streams

    def write(self, data):
        for stream in self._streams:
            stream.write(data)
            stream.flush()

    def flush(self):
        for stream in self._streams:
            stream.flush()


def _client():
    sa_json = os.environ.get("EVOLVESPROUTS_GOOGLE_SERVICE_ACCOUNT_JSON", "")
    if not sa_json:
        sys.exit("EVOLVESPROUTS_GOOGLE_SERVICE_ACCOUNT_JSON not set")
    f = tempfile.NamedTemporaryFile(mode="w", suffix=".json", delete=False)
    f.write(sa_json)
    f.close()
    creds = service_account.Credentials.from_service_account_file(
        f.name, scopes=["https://www.googleapis.com/auth/analytics.readonly"]
    )
    return BetaAnalyticsDataClient(credentials=creds)


def _run(
    client,
    prop,
    dims,
    mets,
    dim_filter=None,
    order_bys=None,
    limit=25,
    date_range="30daysAgo",
):
    req = RunReportRequest(
        property=prop,
        date_ranges=[DateRange(start_date=date_range, end_date="today")],
        dimensions=[Dimension(name=d) for d in dims],
        metrics=[Metric(name=m) for m in mets],
        limit=limit,
    )
    if dim_filter:
        req.dimension_filter = dim_filter
    if order_bys:
        req.order_bys = order_bys
    return client.run_report(req)


def main():
    prop_id = os.environ.get("EVOLVESPROUTS_GA4_PROPERTY_ID", "")
    if not prop_id:
        sys.exit("EVOLVESPROUTS_GA4_PROPERTY_ID not set")

    client = _client()
    prop = f"properties/{prop_id}"

    # Site overview
    print("--- SITE OVERVIEW (Last 30 Days) ---")
    try:
        r = _run(
            client,
            prop,
            [],
            [
                "sessions",
                "totalUsers",
                "newUsers",
                "engagedSessions",
                "averageSessionDuration",
                "bounceRate",
                "engagementRate",
                "userEngagementDuration",
                "screenPageViews",
                "conversions",
            ],
        )
        for row in r.rows:
            v = row.metric_values
            print(
                f"  Sessions: {v[0].value} | Users: {v[1].value} "
                f"(New: {v[2].value})\n"
                f"  Engaged: {v[3].value} | Avg Session Duration: "
                f"{float(v[4].value):.0f}s | "
                f"Bounce: {float(v[5].value) * 100:.1f}%\n"
                f"  Engagement Rate: {float(v[6].value) * 100:.1f}% | "
                f"Avg Engagement Time: {float(v[7].value) / max(int(v[1].value or 1), 1):.1f}s/user\n"
                f"  Pageviews: {v[8].value} | Conversions: {v[9].value}"
            )
    except Exception as exc:
        print(f"  Error: {exc}")
    print()

    # Traffic by source/medium
    print("--- TRAFFIC BY SOURCE/MEDIUM (Last 30 Days) ---")
    try:
        r = _run(
            client,
            prop,
            ["sessionSource", "sessionMedium"],
            ["sessions", "totalUsers", "engagedSessions", "conversions", "bounceRate"],
            order_bys=[{"metric": {"metric_name": "sessions"}, "desc": True}],
            limit=20,
        )
        for row in r.rows:
            src = row.dimension_values[0].value
            med = row.dimension_values[1].value
            v = row.metric_values
            bounce = float(v[4].value) * 100
            print(
                f"  {src}/{med} | Sessions: {v[0].value} | "
                f"Users: {v[1].value} | Engaged: {v[2].value} | "
                f"Conv: {v[3].value} | Bounce: {bounce:.0f}%"
            )
    except Exception as exc:
        print(f"  Error: {exc}")
    print()

    # Google Ads (CPC) traffic
    print("--- GOOGLE ADS (CPC) TRAFFIC (Last 30 Days) ---")
    try:
        r = _run(
            client,
            prop,
            ["sessionSource", "sessionMedium", "sessionCampaignName"],
            ["sessions", "totalUsers", "conversions"],
            dim_filter={
                "filter": {
                    "field_name": "sessionMedium",
                    "string_filter": {"value": "cpc"},
                }
            },
            limit=20,
        )
        if not r.rows:
            print("  No CPC traffic.")
        for row in r.rows:
            d = row.dimension_values
            v = row.metric_values
            print(
                f"  {d[0].value}/{d[1].value}/{d[2].value} | "
                f"Sessions: {v[0].value} | Users: {v[1].value} | "
                f"Conv: {v[2].value}"
            )
    except Exception as exc:
        print(f"  Error: {exc}")
    print()

    # Social traffic
    print("--- SOCIAL TRAFFIC (Last 30 Days) ---")
    try:
        r = _run(
            client,
            prop,
            ["sessionSource", "sessionMedium"],
            ["sessions", "totalUsers", "engagedSessions", "conversions"],
            dim_filter={
                "or_group": {
                    "expressions": [
                        {
                            "filter": {
                                "field_name": "sessionSource",
                                "string_filter": {"value": s, "match_type": 1},
                            }
                        }
                        for s in [
                            "instagram",
                            "facebook",
                            "l.instagram.com",
                            "l.facebook.com",
                            "facebook.com",
                            "m.facebook.com",
                        ]
                    ]
                    + [
                        {
                            "filter": {
                                "field_name": "sessionMedium",
                                "string_filter": {"value": m, "match_type": 1},
                            }
                        }
                        for m in ["social", "paid_social"]
                    ]
                }
            },
            limit=20,
        )
        if not r.rows:
            print("  No social traffic.")
        for row in r.rows:
            d = row.dimension_values
            v = row.metric_values
            print(
                f"  {d[0].value}/{d[1].value} | Sessions: {v[0].value} | "
                f"Users: {v[1].value} | Engaged: {v[2].value} | "
                f"Conv: {v[3].value}"
            )
    except Exception as exc:
        print(f"  Error: {exc}")
    print()

    # Key events & booking funnel
    booking_events = [
        "booking_modal_open",
        "booking_age_selected",
        "booking_date_selected",
        "booking_confirm_pay_click",
        "booking_payment_method_selected",
        "booking_submit_attempt",
        "booking_submit_success",
        "booking_submit_error",
        "booking_thank_you_view",
    ]
    lead_events = [
        "contact_form_submit_attempt",
        "contact_form_submit_success",
        "media_form_submit_success",
        "community_signup_submit_success",
        "whatsapp_click",
    ]
    all_events = booking_events + lead_events

    print("--- KEY EVENTS & BOOKING FUNNEL (Last 30 Days) ---")
    try:
        r = _run(
            client,
            prop,
            ["eventName"],
            ["eventCount", "totalUsers"],
            dim_filter={
                "or_group": {
                    "expressions": [
                        {
                            "filter": {
                                "field_name": "eventName",
                                "string_filter": {"value": ev, "match_type": 1},
                            }
                        }
                        for ev in all_events
                    ]
                }
            },
        )
        if not r.rows:
            print("  No key events.")
        for row in r.rows:
            print(
                f"  {row.dimension_values[0].value}: "
                f"{row.metric_values[0].value} events "
                f"({row.metric_values[1].value} users)"
            )
    except Exception as exc:
        print(f"  Error: {exc}")
    print()

    # Booking events by date
    print("--- BOOKING EVENTS BY DATE (Last 30 Days) ---")
    try:
        r = _run(
            client,
            prop,
            ["date", "eventName"],
            ["eventCount", "totalUsers"],
            dim_filter={
                "or_group": {
                    "expressions": [
                        {
                            "filter": {
                                "field_name": "eventName",
                                "string_filter": {"value": ev, "match_type": 1},
                            }
                        }
                        for ev in all_events
                    ]
                }
            },
            order_bys=[{"dimension": {"dimension_name": "date"}, "desc": True}],
        )
        if not r.rows:
            print("  No data.")
        for row in r.rows:
            print(
                f"  {row.dimension_values[0].value} | "
                f"{row.dimension_values[1].value}: "
                f"{row.metric_values[0].value} "
                f"({row.metric_values[1].value} users)"
            )
    except Exception as exc:
        print(f"  Error: {exc}")
    print()

    # Top landing pages
    print("--- TOP LANDING PAGES (Last 30 Days) ---")
    try:
        r = _run(
            client,
            prop,
            ["landingPage"],
            ["sessions", "conversions", "bounceRate"],
            order_bys=[{"metric": {"metric_name": "sessions"}, "desc": True}],
            limit=15,
        )
        for row in r.rows:
            page = row.dimension_values[0].value
            v = row.metric_values
            bounce = float(v[2].value) * 100
            print(
                f"  {page} | Sessions: {v[0].value} | "
                f"Conv: {v[1].value} | Bounce: {bounce:.0f}%"
            )
    except Exception as exc:
        print(f"  Error: {exc}")
    print()

    # Google CPC landing page performance (paid-quality deep dive)
    print("--- GOOGLE CPC LANDING PAGES (Last 30 Days) ---")
    try:
        r = _run(
            client,
            prop,
            ["landingPage"],
            ["sessions", "engagedSessions", "conversions", "bounceRate"],
            dim_filter={
                "filter": {
                    "field_name": "sessionMedium",
                    "string_filter": {"value": "cpc"},
                }
            },
            order_bys=[{"metric": {"metric_name": "sessions"}, "desc": True}],
            limit=15,
        )
        if not r.rows:
            print("  No CPC landing data.")
        for row in r.rows:
            page = row.dimension_values[0].value
            v = row.metric_values
            bounce = float(v[3].value) * 100
            print(
                f"  {page} | Sessions: {v[0].value} | "
                f"Engaged: {v[1].value} | Conv: {v[2].value} | "
                f"Bounce: {bounce:.0f}%"
            )
    except Exception as exc:
        print(f"  Error: {exc}")
    print()

    # (direct)/(none) landing page breakdown (dark-social visibility)
    print("--- (DIRECT)/(NONE) LANDING PAGES (Last 30 Days) ---")
    try:
        r = _run(
            client,
            prop,
            ["landingPage"],
            ["sessions", "engagedSessions", "conversions", "bounceRate"],
            dim_filter={
                "and_group": {
                    "expressions": [
                        {
                            "filter": {
                                "field_name": "sessionSource",
                                "string_filter": {"value": "(direct)"},
                            }
                        },
                        {
                            "filter": {
                                "field_name": "sessionMedium",
                                "string_filter": {"value": "(none)"},
                            }
                        },
                    ]
                }
            },
            order_bys=[{"metric": {"metric_name": "sessions"}, "desc": True}],
            limit=15,
        )
        if not r.rows:
            print("  No direct traffic.")
        for row in r.rows:
            page = row.dimension_values[0].value
            v = row.metric_values
            bounce = float(v[3].value) * 100
            print(
                f"  {page} | Sessions: {v[0].value} | "
                f"Engaged: {v[1].value} | Conv: {v[2].value} | "
                f"Bounce: {bounce:.0f}%"
            )
    except Exception as exc:
        print(f"  Error: {exc}")

    print("\n--- GA4 ASSESSMENT COMPLETE ---")


def _parse_args():
    parser = argparse.ArgumentParser(description=__doc__ or "")
    parser.add_argument(
        "--out",
        help="Optional path to tee stdout into (plaintext). Useful for "
        "auto-capturing raw output into marketing/generated-reports/.",
    )
    return parser.parse_args()


def _run_main():
    args = _parse_args()
    if args.out:
        out_dir = os.path.dirname(os.path.abspath(args.out))
        if out_dir:
            os.makedirs(out_dir, exist_ok=True)
        with open(args.out, "w", encoding="utf-8") as fh:
            tee = _Tee(sys.stdout, fh)
            with contextlib.redirect_stdout(tee):
                main()
    else:
        main()


if __name__ == "__main__":
    _run_main()
