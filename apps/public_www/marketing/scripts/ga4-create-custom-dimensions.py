"""GA4 Admin API: Register custom dimensions for analytics event parameters.

Reads the analytics taxonomy from the codebase and ensures every custom
event parameter (commonParams + per-event allowedCustomParams) is
registered as a GA4 event-scoped custom dimension so it is available for
filtering and reporting.

GA4 automatically collects page_path and page_title; those are skipped.
`total_amount` and `discount_amount` are registered as custom metrics
(currency / standard, respectively) rather than dimensions.

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
    python3 ga4-create-custom-dimensions.py
"""

import json
import os
import sys
import tempfile
from pathlib import Path

from google.analytics.admin_v1alpha import AnalyticsAdminServiceClient
from google.analytics.admin_v1alpha.types import (
    CustomDimension,
    CustomMetric,
)
from google.api_core import exceptions as api_exceptions
from google.oauth2 import service_account

TAXONOMY_PATH = (
    Path(__file__).resolve().parent.parent.parent
    / "src"
    / "lib"
    / "analytics-taxonomy.json"
)

GA4_AUTO_COLLECTED = {"page_path", "page_title"}

METRIC_PARAMS = {
    "total_amount": {
        "display_name": "Total Amount",
        "description": "Monetary total for the booking or transaction (HKD).",
        "measurement_unit": CustomMetric.MeasurementUnit.CURRENCY,
    },
    "discount_amount": {
        "display_name": "Discount Amount",
        "description": "Applied discount amount for the booking (HKD).",
        "measurement_unit": CustomMetric.MeasurementUnit.STANDARD,
    },
}

DISPLAY_NAMES = {
    "section_id": "Section ID",
    "cta_location": "CTA Location",
    "page_locale": "Page Locale",
    "environment": "Environment",
    "form_type": "Form Type",
    "form_kind": "Form Kind",
    "form_id": "Form ID",
    "error_type": "Error Type",
    "resource_key": "Resource Key",
    "service_tier": "Service Tier",
    "cohort_label": "Cohort Label",
    "cohort_date": "Cohort Date",
    "is_fully_booked": "Is Fully Booked",
    "payment_method": "Payment Method",
    "discount_type": "Discount Type",
    "landing_page_slug": "Landing Page Slug",
    "content_name": "Content Name",
}

DESCRIPTIONS = {
    "section_id": "UI section where the event fired (e.g. consultations-booking, events-booking).",
    "cta_location": "Specific CTA trigger location within the section.",
    "page_locale": "Locale of the page at event time (e.g. en, zh-HK).",
    "environment": "Deployment environment: prod or staging.",
    "form_type": "Contact or signup form variant identifier.",
    "form_kind": "Cross-form category: contact, media_request, community, or reservation.",
    "form_id": "Stable identifier for a specific form instance (orthogonal to section_id).",
    "error_type": "Error classification for failed submissions.",
    "resource_key": "Identifier for the downloadable resource / media guide.",
    "service_tier": "Selected service tier label for booking events.",
    "cohort_label": "Selected cohort / date label for booking events.",
    "cohort_date": "Cohort start date (YYYY-MM-DD) for booking events.",
    "is_fully_booked": "Whether the selected cohort is fully booked (true/false).",
    "payment_method": "Selected payment method (fps_qr, bank_transfer, etc.).",
    "discount_type": "Type of discount applied (percentage, fixed, etc.).",
    "landing_page_slug": "URL slug of the landing page that triggered the event.",
    "content_name": "Name/label of the content item clicked.",
}


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


def load_taxonomy():
    with open(TAXONOMY_PATH, "r") as fh:
        return json.load(fh)


def collect_dimension_params(taxonomy):
    """Return the set of parameter names that should be dimensions."""
    params = set()
    for param in taxonomy.get("commonParams", []):
        if param not in GA4_AUTO_COLLECTED and param not in METRIC_PARAMS:
            params.add(param)
    for event_def in taxonomy.get("events", {}).values():
        for param in event_def.get("allowedCustomParams", []):
            if param not in GA4_AUTO_COLLECTED and param not in METRIC_PARAMS:
                params.add(param)
    return sorted(params)


def collect_metric_params(taxonomy):
    """Return the set of parameter names that should be metrics."""
    all_params = set()
    for param in taxonomy.get("commonParams", []):
        all_params.add(param)
    for event_def in taxonomy.get("events", {}).values():
        for param in event_def.get("allowedCustomParams", []):
            all_params.add(param)
    return sorted(p for p in all_params if p in METRIC_PARAMS)


def fallback_display_name(param_name):
    return param_name.replace("_", " ").title()


def main():
    property_id = os.environ.get("EVOLVESPROUTS_GA4_PROPERTY_ID", "")
    if not property_id:
        sys.exit("Missing EVOLVESPROUTS_GA4_PROPERTY_ID")

    client = _client()
    parent = f"properties/{property_id}"
    sa_email = os.environ.get("EVOLVESPROUTS_GOOGLE_CLIENT_EMAIL", "unknown")

    print(f"GA4 Property: {property_id}")
    print(f"Service account: {sa_email}")
    print(f"Taxonomy: {TAXONOMY_PATH}\n")

    taxonomy = load_taxonomy()
    dimension_params = collect_dimension_params(taxonomy)
    metric_params = collect_metric_params(taxonomy)

    print(f"Dimensions to register: {len(dimension_params)}")
    for p in dimension_params:
        print(f"  - {p}")
    print(f"Metrics to register: {len(metric_params)}")
    for p in metric_params:
        print(f"  - {p}")
    print()

    existing_dims = {}
    try:
        for dim in client.list_custom_dimensions(parent=parent):
            existing_dims[dim.parameter_name] = dim.display_name
            print(f"  Existing dimension: {dim.parameter_name} ({dim.display_name})")
    except api_exceptions.PermissionDenied:
        print("  Cannot list custom dimensions — check property access.")
        sys.exit(1)

    existing_metrics = {}
    try:
        for met in client.list_custom_metrics(parent=parent):
            existing_metrics[met.parameter_name] = met.display_name
            print(f"  Existing metric: {met.parameter_name} ({met.display_name})")
    except api_exceptions.PermissionDenied:
        print("  Cannot list custom metrics — check property access.")
        sys.exit(1)

    print()

    dim_created = 0
    dim_skipped = 0
    for param in dimension_params:
        if param in existing_dims:
            print(f"  '{param}' — already registered as dimension, skipping.")
            dim_skipped += 1
            continue
        display_name = DISPLAY_NAMES.get(param, fallback_display_name(param))
        description = DESCRIPTIONS.get(param, f"Custom dimension for {param} event parameter.")
        try:
            result = client.create_custom_dimension(
                parent=parent,
                custom_dimension=CustomDimension(
                    parameter_name=param,
                    display_name=display_name,
                    scope=CustomDimension.DimensionScope.EVENT,
                    description=description,
                ),
            )
            print(f"  '{param}' — created dimension ({result.name})")
            dim_created += 1
        except api_exceptions.PermissionDenied:
            print(f"  '{param}' — PERMISSION DENIED")
            print(f"\n  The service account needs Editor role on GA4 property.")
            print(f"  Go to: GA4 Admin > Property Access Management")
            print(f"  Find: {sa_email}")
            print(f"  Change: Viewer -> Editor")
            print(f"  Then re-run this script and revoke back to Viewer.")
            sys.exit(1)
        except api_exceptions.AlreadyExists:
            print(f"  '{param}' — already exists (race), skipping.")
            dim_skipped += 1
        except api_exceptions.InvalidArgument as e:
            print(f"  '{param}' — invalid: {e.message}")
        except Exception as e:
            print(f"  '{param}' — error: {e}")

    met_created = 0
    met_skipped = 0
    for param in metric_params:
        if param in existing_metrics:
            print(f"  '{param}' — already registered as metric, skipping.")
            met_skipped += 1
            continue
        config = METRIC_PARAMS[param]
        try:
            result = client.create_custom_metric(
                parent=parent,
                custom_metric=CustomMetric(
                    parameter_name=param,
                    display_name=config["display_name"],
                    scope=CustomMetric.MetricScope.EVENT,
                    measurement_unit=config["measurement_unit"],
                    description=config["description"],
                ),
            )
            print(f"  '{param}' — created metric ({result.name})")
            met_created += 1
        except api_exceptions.PermissionDenied:
            print(f"  '{param}' — PERMISSION DENIED for metric")
            print(f"\n  The service account needs Editor role on GA4 property.")
            sys.exit(1)
        except api_exceptions.AlreadyExists:
            print(f"  '{param}' — already exists (race), skipping.")
            met_skipped += 1
        except api_exceptions.InvalidArgument as e:
            print(f"  '{param}' — invalid metric: {e.message}")
        except Exception as e:
            print(f"  '{param}' — metric error: {e}")

    total_dims = dim_created + dim_skipped
    total_mets = met_created + met_skipped
    print(f"\nDimensions: {dim_created} created, {dim_skipped} skipped "
          f"({total_dims}/{len(dimension_params)} ready).")
    print(f"Metrics: {met_created} created, {met_skipped} skipped "
          f"({total_mets}/{len(metric_params)} ready).")
    if total_dims == len(dimension_params) and total_mets == len(metric_params):
        print("\nAll custom dimensions and metrics registered.")
        print("Remember to revoke Editor access back to Viewer.")


if __name__ == "__main__":
    main()
