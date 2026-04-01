# Marketing Assessment Scripts

Read-only scripts for querying ad platform and analytics APIs to assess
Evolve Sprouts marketing performance.

## Folder structure

```
marketing/
├── scripts/
│   ├── google-ads-assessment.py      # Google Ads API (campaigns, keywords, ads)
│   ├── meta-ads-assessment.py        # Meta Marketing API (campaigns, ad sets, ads)
│   ├── meta-ads-manage-access.py     # Meta ad account external access management
│   ├── ga4-assessment.py             # GA4 Data API (traffic, funnel, events)
│   ├── ga4-create-audiences.py       # GA4 Admin API (create remarketing audiences)
│   └── requirements.txt              # Python dependencies
└── reports/
    └── ads-performance-assessment-YYYY-MM-DD.md
```

## Prerequisites

Install Python dependencies:

```bash
pip install -r scripts/requirements.txt
```

## Required environment variables

All scripts use Cursor Cloud Agent secrets (injected as env vars):

| Variable | Script | Purpose |
|---|---|---|
| `EVOLVESPROUTS_GOOGLE_ADS_DEVELOPER_TOKEN` | google-ads | API developer token |
| `EVOLVESPROUTS_GOOGLE_ADS_CUSTOMER_ID` | google-ads | MCC (manager) account ID |
| `EVOLVESPROUTS_GOOGLE_SERVICE_ACCOUNT_JSON` | google-ads, ga4 | GCP service account credentials |
| `EVOLVESPROUTS_GA4_PROPERTY_ID` | ga4 | GA4 property ID |
| `EVOLVESPROUTS_META_SYSTEM_USER_ACCESS_TOKEN` | meta-ads | System user access token |
| `EVOLVESPROUTS_META_AD_ACCOUNT_ID` | meta-ads | Ad account ID (`act_...`) |
| `EVOLVESPROUTS_GOOGLE_CLIENT_EMAIL` | ga4-create-audiences | Service account email |

## Usage

### Assessment scripts (read-only)

Run from the `marketing/scripts/` directory or provide the full path:

```bash
python3 scripts/google-ads-assessment.py
python3 scripts/meta-ads-assessment.py
python3 scripts/ga4-assessment.py
```

### Meta ad account external access management

Grant an external Meta Business read-only access to ad analytics:

```bash
# List who currently has agency access
python3 scripts/meta-ads-manage-access.py list

# Grant read-only analytics access to an external business
python3 scripts/meta-ads-manage-access.py grant <EXTERNAL_BUSINESS_ID>

# Grant with broader permissions (e.g. advertise + analyze)
python3 scripts/meta-ads-manage-access.py grant <EXTERNAL_BUSINESS_ID> --tasks ADVERTISE ANALYZE

# Revoke access from an external business
python3 scripts/meta-ads-manage-access.py revoke <EXTERNAL_BUSINESS_ID>
```

The external party must provide their **Meta Business Manager ID** (a numeric
ID visible at business.facebook.com/settings). By default, only `ANALYZE`
(reporting-only) access is granted.

### GA4 audience creation (requires temporary Editor access)

The `ga4-create-audiences.py` script creates three remarketing audiences.
It requires temporary Editor access on the GA4 property:

1. Go to GA4 Admin > Property Access Management
2. Find `ga4-reader@evolve-sprouts.iam.gserviceaccount.com`
3. Change role from Viewer to Editor
4. Run: `python3 scripts/ga4-create-audiences.py`
5. Revoke back to Viewer after done

The assessment scripts are read-only and make no changes to any platform.

## Reports

Assessment reports are stored in `reports/` with the naming convention
`ads-performance-assessment-YYYY-MM-DD.md`. Each report captures a
point-in-time snapshot of ad performance data and includes analysis and
recommendations.
