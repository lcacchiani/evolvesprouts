"""Google Ads performance assessment (read-only).

Queries the Google Ads API via service account through the MCC (manager)
account to pull campaign, ad group, keyword, ad, and conversion data.

Required environment variables:
    EVOLVESPROUTS_GOOGLE_ADS_CUSTOMER_ID   Manager (MCC) account ID
    EVOLVESPROUTS_GOOGLE_ADS_DEVELOPER_TOKEN  API developer token
    EVOLVESPROUTS_GOOGLE_SERVICE_ACCOUNT_JSON  Service account credentials JSON

Usage:
    python3 google-ads-assessment.py [--out PATH]

`--out` mirrors stdout to the given file (plaintext).
"""

import argparse
import contextlib
import os
import sys
import tempfile

from google.ads.googleads.client import GoogleAdsClient

API_VERSION = "v20"


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


def _sa_path():
    sa_json = os.environ.get("EVOLVESPROUTS_GOOGLE_SERVICE_ACCOUNT_JSON", "")
    if not sa_json:
        sys.exit("EVOLVESPROUTS_GOOGLE_SERVICE_ACCOUNT_JSON not set")
    f = tempfile.NamedTemporaryFile(mode="w", suffix=".json", delete=False)
    f.write(sa_json)
    f.close()
    return f.name


def _micros(value):
    return value / 1_000_000 if value else 0


def main():
    manager_id = os.environ.get("EVOLVESPROUTS_GOOGLE_ADS_CUSTOMER_ID", "").replace(
        "-", ""
    )
    dev_token = os.environ.get("EVOLVESPROUTS_GOOGLE_ADS_DEVELOPER_TOKEN", "")
    if not manager_id or not dev_token:
        sys.exit("Missing GOOGLE_ADS_CUSTOMER_ID or DEVELOPER_TOKEN")

    client = GoogleAdsClient.load_from_dict(
        {
            "developer_token": dev_token,
            "json_key_file_path": _sa_path(),
            "impersonated_email": "",
            "login_customer_id": manager_id,
            "use_proto_plus": True,
        },
        version=API_VERSION,
    )
    svc = client.get_service("GoogleAdsService")

    print("=" * 60)
    print(f"MANAGER ACCOUNT: {manager_id}")
    print("=" * 60)

    # List client accounts under MCC
    try:
        rows = svc.search(
            customer_id=manager_id,
            query="""
                SELECT customer_client.id, customer_client.descriptive_name,
                       customer_client.status
                FROM customer_client
                WHERE customer_client.manager = FALSE
            """,
        )
        client_ids = []
        print("\n--- CLIENT ACCOUNTS ---")
        for r in rows:
            cc = r.customer_client
            print(f"  {cc.descriptive_name} (ID: {cc.id}, {cc.status.name})")
            client_ids.append(str(cc.id))
    except Exception as exc:
        print(f"Error listing clients: {exc}")
        client_ids = ["4991144901"]

    for cid in client_ids:
        print(f"\n{'=' * 60}")
        print(f"CLIENT ACCOUNT: {cid}")
        print(f"{'=' * 60}")

        # Account info
        try:
            for r in svc.search(
                customer_id=cid,
                query="SELECT customer.id, customer.descriptive_name, "
                "customer.currency_code, customer.time_zone, customer.status "
                "FROM customer LIMIT 1",
            ):
                c = r.customer
                print(
                    f"\nAccount: {c.descriptive_name} | {c.currency_code} | "
                    f"{c.time_zone} | {c.status.name}"
                )
        except Exception as exc:
            print(f"Account info error: {exc}")
            continue

        # Campaigns
        try:
            print("\n--- CAMPAIGNS ---")
            for r in svc.search(
                customer_id=cid,
                query="""
                    SELECT campaign.id, campaign.name, campaign.status,
                           campaign.advertising_channel_type,
                           campaign_budget.amount_micros,
                           campaign.start_date, campaign.bidding_strategy_type
                    FROM campaign ORDER BY campaign.id
                """,
            ):
                camp = r.campaign
                budget = _micros(r.campaign_budget.amount_micros)
                print(
                    f"  {camp.name} | {camp.status.name} | "
                    f"{camp.advertising_channel_type.name} | "
                    f"HK${budget:.2f}/day | {camp.bidding_strategy_type.name} | "
                    f"Start: {camp.start_date}"
                )
        except Exception as exc:
            print(f"Campaign error: {exc}")

        # Campaign performance (all time)
        try:
            print("\n--- CAMPAIGN PERFORMANCE (All Time) ---")
            for r in svc.search(
                customer_id=cid,
                query="""
                    SELECT campaign.name, campaign.status,
                           metrics.impressions, metrics.clicks, metrics.ctr,
                           metrics.average_cpc, metrics.cost_micros,
                           metrics.conversions, metrics.all_conversions,
                           metrics.interactions
                    FROM campaign ORDER BY metrics.impressions DESC
                """,
            ):
                m = r.metrics
                print(
                    f"  {r.campaign.name} ({r.campaign.status.name})\n"
                    f"    Imp: {m.impressions:,} | Clicks: {m.clicks:,} | "
                    f"CTR: {m.ctr:.2%} | CPC: HK${_micros(m.average_cpc):.2f} | "
                    f"Cost: HK${_micros(m.cost_micros):.2f} | "
                    f"Conv: {m.conversions:.1f}"
                )
        except Exception as exc:
            print(f"All-time performance error: {exc}")

        # Campaign performance (last 7 days)
        try:
            print("\n--- CAMPAIGN PERFORMANCE (Last 7 Days) ---")
            count = 0
            for r in svc.search(
                customer_id=cid,
                query="""
                    SELECT campaign.name, campaign.status,
                           metrics.impressions, metrics.clicks, metrics.ctr,
                           metrics.average_cpc, metrics.cost_micros,
                           metrics.conversions
                    FROM campaign
                    WHERE segments.date DURING LAST_7_DAYS
                    ORDER BY metrics.impressions DESC
                """,
            ):
                count += 1
                m = r.metrics
                print(
                    f"  {r.campaign.name} ({r.campaign.status.name})\n"
                    f"    Imp: {m.impressions:,} | Clicks: {m.clicks:,} | "
                    f"CTR: {m.ctr:.2%} | CPC: HK${_micros(m.average_cpc):.2f} | "
                    f"Cost: HK${_micros(m.cost_micros):.2f} | "
                    f"Conv: {m.conversions:.1f}"
                )
            if count == 0:
                print("  No data for last 7 days.")
        except Exception as exc:
            print(f"7-day performance error: {exc}")

        # Ad group performance
        try:
            print("\n--- AD GROUP PERFORMANCE (All Time) ---")
            for r in svc.search(
                customer_id=cid,
                query="""
                    SELECT ad_group.name, ad_group.status, campaign.name,
                           ad_group.cpc_bid_micros, metrics.impressions,
                           metrics.clicks, metrics.cost_micros, metrics.conversions
                    FROM ad_group ORDER BY metrics.impressions DESC
                """,
            ):
                ag = r.ad_group
                m = r.metrics
                print(
                    f"  {ag.name} ({ag.status.name}) in '{r.campaign.name}'\n"
                    f"    Bid: HK${_micros(ag.cpc_bid_micros):.2f} | "
                    f"Imp: {m.impressions:,} | Clicks: {m.clicks:,} | "
                    f"Cost: HK${_micros(m.cost_micros):.2f} | "
                    f"Conv: {m.conversions:.1f}"
                )
        except Exception as exc:
            print(f"Ad group error: {exc}")

        # Keyword performance
        try:
            print("\n--- KEYWORD PERFORMANCE (All Time, Top 30) ---")
            kw_count = 0
            for r in svc.search(
                customer_id=cid,
                query="""
                    SELECT ad_group_criterion.keyword.text,
                           ad_group_criterion.keyword.match_type,
                           ad_group_criterion.status,
                           ad_group_criterion.quality_info.quality_score,
                           metrics.impressions, metrics.clicks, metrics.ctr,
                           metrics.average_cpc, metrics.cost_micros,
                           metrics.conversions
                    FROM keyword_view
                    ORDER BY metrics.impressions DESC LIMIT 30
                """,
            ):
                kw_count += 1
                kw = r.ad_group_criterion.keyword
                qi = r.ad_group_criterion.quality_info
                m = r.metrics
                qs = qi.quality_score if qi.quality_score else "N/A"
                print(
                    f'  "{kw.text}" ({kw.match_type.name}) | QS: {qs} | '
                    f"Imp: {m.impressions:,} | Clicks: {m.clicks:,} | "
                    f"CTR: {m.ctr:.2%} | CPC: HK${_micros(m.average_cpc):.2f} | "
                    f"Cost: HK${_micros(m.cost_micros):.2f}"
                )
            if kw_count == 0:
                print("  No keyword data.")
        except Exception as exc:
            print(f"Keyword error: {exc}")

        # Ad approval status and performance
        try:
            print("\n--- AD PERFORMANCE & APPROVAL STATUS ---")
            for r in svc.search(
                customer_id=cid,
                query="""
                    SELECT ad_group_ad.ad.id, ad_group_ad.ad.type,
                           ad_group_ad.ad.final_urls, ad_group_ad.status,
                           ad_group_ad.policy_summary.approval_status,
                           campaign.name, ad_group.name,
                           metrics.impressions, metrics.clicks,
                           metrics.cost_micros, metrics.conversions
                    FROM ad_group_ad
                    ORDER BY metrics.impressions DESC LIMIT 10
                """,
            ):
                ad = r.ad_group_ad.ad
                ps = r.ad_group_ad.policy_summary
                m = r.metrics
                urls = list(ad.final_urls) if ad.final_urls else []
                approval = (
                    ps.approval_status.name if ps and ps.approval_status else "UNKNOWN"
                )
                print(
                    f"  Ad {ad.id} ({ad.type.name}) | "
                    f"{r.ad_group_ad.status.name} | Approval: {approval}\n"
                    f"    {r.campaign.name} > {r.ad_group.name}"
                )
                if urls:
                    print(f"    URL: {urls[0]}")
                print(
                    f"    Imp: {m.impressions:,} | Clicks: {m.clicks:,} | "
                    f"Cost: HK${_micros(m.cost_micros):.2f}"
                )
        except Exception as exc:
            print(f"Ad performance error: {exc}")

        # Conversion actions
        try:
            print("\n--- CONVERSION ACTIONS ---")
            for r in svc.search(
                customer_id=cid,
                query="""
                    SELECT conversion_action.id, conversion_action.name,
                           conversion_action.status, conversion_action.type,
                           conversion_action.category
                    FROM conversion_action ORDER BY conversion_action.id
                """,
            ):
                ca = r.conversion_action
                print(
                    f"  {ca.name} | {ca.status.name} | "
                    f"{ca.type.name} | {ca.category.name}"
                )
        except Exception as exc:
            print(f"Conversion actions error: {exc}")

        # Search terms (last 14 days) — surface wasted spend + negatives candidates
        try:
            print("\n--- SEARCH TERMS (Last 14 Days, Top 50) ---")
            st_count = 0
            for r in svc.search(
                customer_id=cid,
                query="""
                    SELECT search_term_view.search_term,
                           search_term_view.status,
                           segments.search_term_match_type,
                           metrics.impressions, metrics.clicks, metrics.ctr,
                           metrics.average_cpc, metrics.cost_micros,
                           metrics.conversions
                    FROM search_term_view
                    WHERE segments.date DURING LAST_14_DAYS
                    ORDER BY metrics.impressions DESC
                    LIMIT 50
                """,
            ):
                st_count += 1
                m = r.metrics
                st = r.search_term_view
                mt = r.segments.search_term_match_type
                print(
                    f'  "{st.search_term}" ({mt.name}) | {st.status.name} | '
                    f"Imp: {m.impressions:,} | Clicks: {m.clicks:,} | "
                    f"CTR: {m.ctr:.2%} | CPC: HK${_micros(m.average_cpc):.2f} | "
                    f"Cost: HK${_micros(m.cost_micros):.2f} | "
                    f"Conv: {m.conversions:.1f}"
                )
            if st_count == 0:
                print("  No search term data.")
        except Exception as exc:
            print(f"Search terms error: {exc}")

        # Daily performance (last 14 days)
        try:
            print("\n--- DAILY PERFORMANCE (Last 14 Days) ---")
            day_count = 0
            for r in svc.search(
                customer_id=cid,
                query="""
                    SELECT segments.date, campaign.name,
                           metrics.impressions, metrics.clicks,
                           metrics.cost_micros, metrics.conversions
                    FROM campaign
                    WHERE segments.date DURING LAST_14_DAYS
                    ORDER BY segments.date DESC
                """,
            ):
                day_count += 1
                m = r.metrics
                print(
                    f"  {r.segments.date} | {r.campaign.name} | "
                    f"Imp: {m.impressions:,} | Clicks: {m.clicks:,} | "
                    f"Cost: HK${_micros(m.cost_micros):.2f} | "
                    f"Conv: {m.conversions:.1f}"
                )
            if day_count == 0:
                print("  No daily data.")
        except Exception as exc:
            print(f"Daily performance error: {exc}")

    print(f"\n{'=' * 60}")
    print("GOOGLE ADS ASSESSMENT COMPLETE")
    print(f"{'=' * 60}")


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
