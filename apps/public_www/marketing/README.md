# Marketing Assessment Scripts

Read-only scripts for querying ad platform and analytics APIs to assess
Evolve Sprouts marketing performance.

## Folder structure

```
marketing/
├── scripts/
│   ├── google-ads-assessment.py   # Google Ads API (campaigns, keywords, ads)
│   ├── meta-ads-assessment.py     # Meta Marketing API (campaigns, ad sets, ads)
│   ├── ga4-assessment.py          # GA4 Data API (traffic, funnel, events)
│   └── requirements.txt           # Python dependencies
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

## Usage

Run from the `marketing/scripts/` directory or provide the full path:

```bash
python3 scripts/google-ads-assessment.py
python3 scripts/meta-ads-assessment.py
python3 scripts/ga4-assessment.py
```

All scripts are read-only and make no changes to any ad platform or analytics
property.

## Reports

Assessment reports are stored in `reports/` with the naming convention
`ads-performance-assessment-YYYY-MM-DD.md`. Each report captures a
point-in-time snapshot of ad performance data and includes analysis and
recommendations.
