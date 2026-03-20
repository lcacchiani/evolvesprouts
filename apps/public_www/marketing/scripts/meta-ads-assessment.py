"""Meta Ads performance assessment (read-only).

Queries the Meta Marketing API for ad account, campaign, ad set, ad, and
daily performance data.

Required environment variables:
    EVOLVESPROUTS_META_SYSTEM_USER_ACCESS_TOKEN  System user access token
    EVOLVESPROUTS_META_AD_ACCOUNT_ID             Ad account ID (act_...)

Usage:
    python3 meta-ads-assessment.py
"""

import json
import os
import sys
from datetime import datetime, timedelta

import requests

BASE_URL = "https://graph.facebook.com/v21.0"


def _auth_headers():
    token = os.environ.get("EVOLVESPROUTS_META_SYSTEM_USER_ACCESS_TOKEN", "")
    if not token:
        sys.exit("EVOLVESPROUTS_META_SYSTEM_USER_ACCESS_TOKEN not set")
    return {"Authorization": f"Bearer {token}"}


def _get(endpoint, params=None):
    if params is None:
        params = {}
    resp = requests.get(
        f"{BASE_URL}/{endpoint}",
        params=params,
        headers=_auth_headers(),
        timeout=30,
    )
    if resp.status_code != 200:
        error_body = (
            resp.json()
            if resp.headers.get("content-type", "").startswith("application/json")
            else {}
        )
        error_msg = error_body.get("error", {}).get(
            "message", f"HTTP {resp.status_code}"
        )
        print(f"API Error for {endpoint}: {error_msg}")
        return None
    return resp.json()


def _fmt_actions(actions):
    return ", ".join(a["action_type"] + ": " + a["value"] for a in actions)


def _fmt_costs(costs):
    return ", ".join(
        c["action_type"] + ": HK$" + f"{float(c['value']):.2f}" for c in costs
    )


def main():
    acct = os.environ.get("EVOLVESPROUTS_META_AD_ACCOUNT_ID", "")
    if not acct:
        sys.exit("EVOLVESPROUTS_META_AD_ACCOUNT_ID not set")

    today = datetime.now().strftime("%Y-%m-%d")
    d30 = (datetime.now() - timedelta(days=30)).strftime("%Y-%m-%d")
    d14 = (datetime.now() - timedelta(days=14)).strftime("%Y-%m-%d")

    print(f"Ad Account: {acct}")
    print(f"Date: {today}\n")

    # Account info
    print("--- AD ACCOUNT INFO ---")
    data = _get(
        acct,
        {
            "fields": "name,account_id,account_status,currency,timezone_name,"
            "amount_spent,balance,spend_cap,created_time"
        },
    )
    if data:
        status_map = {1: "ACTIVE", 2: "DISABLED", 3: "UNSETTLED"}
        status = status_map.get(
            data.get("account_status"), f"({data.get('account_status')})"
        )
        print(
            f"  {data.get('name')} | {status} | {data.get('currency')}\n"
            f"  Spent: {data.get('amount_spent')} | Balance: {data.get('balance')}"
        )
    print()

    # Campaigns
    print("--- CAMPAIGNS ---")
    data = _get(
        f"{acct}/campaigns",
        {
            "fields": "name,status,objective,daily_budget,lifetime_budget,"
            "start_time,stop_time,buying_type,bid_strategy",
            "limit": 50,
        },
    )
    if data and "data" in data:
        for camp in data["data"]:
            daily = (
                float(camp.get("daily_budget", 0)) / 100
                if camp.get("daily_budget")
                else None
            )
            print(f"  {camp.get('name')}")
            print(
                f"    ID: {camp['id']} | {camp.get('status')} | {camp.get('objective')}"
            )
            if daily:
                print(f"    Budget: HK${daily:.2f}/day")
            print(
                f"    {camp.get('start_time', 'N/A')} to {camp.get('stop_time', 'N/A')}"
            )
    print()

    # Ad sets
    print("--- AD SETS ---")
    data = _get(
        f"{acct}/adsets",
        {
            "fields": "name,status,optimization_goal,billing_event,"
            "daily_budget,targeting",
            "limit": 50,
        },
    )
    if data and "data" in data:
        for adset in data["data"]:
            daily = (
                float(adset.get("daily_budget", 0)) / 100
                if adset.get("daily_budget")
                else None
            )
            print(f"  {adset.get('name')}")
            print(
                f"    {adset.get('status')} | Opt: {adset.get('optimization_goal')} | "
                f"Billing: {adset.get('billing_event')}"
            )
            if daily:
                print(f"    Budget: HK${daily:.2f}/day")
            t = adset.get("targeting", {})
            if t:
                geo = t.get("geo_locations", {})
                countries = geo.get("countries", []) if geo else []
                gender_map = {1: "Male", 2: "Female"}
                genders = [gender_map.get(g, g) for g in t.get("genders", [])]
                print(
                    f"    Geo: {countries} | Age: {t.get('age_min')}-"
                    f"{t.get('age_max')} | Gender: {genders}"
                )
    print()

    # Campaign insights (30 days)
    print("--- CAMPAIGN INSIGHTS (Last 30 Days) ---")
    data = _get(
        f"{acct}/insights",
        {
            "fields": "campaign_name,impressions,reach,clicks,cpc,cpm,ctr,"
            "spend,actions,cost_per_action_type,frequency,unique_clicks",
            "time_range": json.dumps({"since": d30, "until": today}),
            "level": "campaign",
            "limit": 50,
        },
    )
    if data and "data" in data:
        if not data["data"]:
            print("  No data.")
        for row in data["data"]:
            spend = float(row.get("spend", 0))
            print(f"\n  {row.get('campaign_name')}")
            print(
                f"    Imp: {int(row.get('impressions', 0)):,} | "
                f"Reach: {int(row.get('reach', 0)):,} | "
                f"Freq: {row.get('frequency', 'N/A')}"
            )
            print(
                f"    Clicks: {int(row.get('clicks', 0)):,} "
                f"(Unique: {row.get('unique_clicks', 'N/A')}) | "
                f"CTR: {row.get('ctr', 'N/A')}%"
            )
            print(
                f"    CPC: HK${float(row.get('cpc', 0)):.2f} | "
                f"CPM: HK${float(row.get('cpm', 0)):.2f} | "
                f"Spend: HK${spend:.2f}"
            )
            actions = row.get("actions", [])
            if actions:
                print(f"    Actions: {_fmt_actions(actions)}")
            cpat = row.get("cost_per_action_type", [])
            if cpat:
                print(f"    Cost/Action: {_fmt_costs(cpat)}")
    print()

    # Ad-level insights
    print("--- AD-LEVEL INSIGHTS (Last 30 Days) ---")
    data = _get(
        f"{acct}/insights",
        {
            "fields": "ad_name,ad_id,impressions,reach,clicks,cpc,cpm,ctr,"
            "spend,actions",
            "time_range": json.dumps({"since": d30, "until": today}),
            "level": "ad",
            "limit": 50,
        },
    )
    if data and "data" in data:
        if not data["data"]:
            print("  No data.")
        for row in data["data"]:
            spend = float(row.get("spend", 0))
            print(f"\n  {row.get('ad_name')}")
            print(
                f"    Imp: {int(row.get('impressions', 0)):,} | "
                f"Reach: {int(row.get('reach', 0)):,} | "
                f"Clicks: {int(row.get('clicks', 0)):,} | "
                f"CTR: {row.get('ctr', 'N/A')}% | Spend: HK${spend:.2f}"
            )
            actions = row.get("actions", [])
            if actions:
                print(f"    Actions: {_fmt_actions(actions)}")
    print()

    # Daily breakdown (14 days)
    print("--- DAILY BREAKDOWN (Last 14 Days) ---")
    data = _get(
        f"{acct}/insights",
        {
            "fields": "impressions,reach,clicks,spend,actions,ctr,cpc,cpm",
            "time_range": json.dumps({"since": d14, "until": today}),
            "time_increment": 1,
            "limit": 30,
        },
    )
    if data and "data" in data:
        if not data["data"]:
            print("  No data.")
        for row in data["data"]:
            spend = float(row.get("spend", 0))
            actions = row.get("actions", [])
            act_str = ""
            if actions:
                act_str = " | " + _fmt_actions(actions[:5])
            print(
                f"  {row.get('date_start')} | "
                f"Imp: {int(row.get('impressions', 0)):,} | "
                f"Reach: {int(row.get('reach', 0)):,} | "
                f"Clicks: {int(row.get('clicks', 0)):,} | "
                f"CTR: {row.get('ctr', 'N/A')}% | "
                f"CPM: HK${float(row.get('cpm', 0)):.2f} | "
                f"Spend: HK${spend:.2f}{act_str}"
            )
    print()

    print("--- META ADS ASSESSMENT COMPLETE ---")


if __name__ == "__main__":
    main()
