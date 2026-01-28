# Security Assessment Report

**Repository**: evolvesprouts (public)
**Assessment Date**: 2026-01-28
**Status**: Comprehensive review completed

## Executive Summary

This security assessment evaluates the evolvesprouts repository, a public AWS Lambda-based backend with CloudFormation infrastructure. The codebase demonstrates **good security practices** overall, with proper use of AWS security services and no critical vulnerabilities identified.

### Risk Rating: **LOW**

| Category | Status | Notes |
|----------|--------|-------|
| Dependency Security | ✅ Pass | No known vulnerabilities |
| Code Security (Bandit) | ✅ Pass | No issues identified |
| Secrets Management | ✅ Pass | No hardcoded secrets |
| Authentication | ✅ Pass | Proper JWT/Cognito implementation |
| Infrastructure | ⚠️ Review | Minor recommendations below |

---

## 1. Automated Scanning Results

### 1.1 Static Application Security Testing (Bandit)

```
Total lines of code: 1482
Total potential issues: 0
- High severity: 0
- Medium severity: 0
- Low severity: 0
```

**Result**: No security issues identified in Python code.

### 1.2 Dependency Audit

Dependencies analyzed:
- SQLAlchemy >=2.0.0,<3.0.0
- boto3 >=1.34.0,<2.0.0
- psycopg[binary] >=3.1.0,<4.0.0

**Result**: All dependencies use current stable versions with no known CVEs.

### 1.3 Secret Detection

- No hardcoded passwords, API keys, or tokens found
- All sensitive values are loaded from environment variables
- Parameter files use placeholder values (`change-me`, `example.com`)

---

## 2. Code Security Analysis

### 2.1 Authentication & Authorization

**Strengths:**
- ✅ JWT validation delegated to API Gateway authorizer
- ✅ Admin group membership verification (`require_admin()`)
- ✅ API key validation for public endpoints (`require_public_api_key()`)
- ✅ No sensitive data in error responses (uses error codes only)
- ✅ Proper header normalization to prevent case-sensitivity attacks

**Code Reference** (`backend/src/app/auth.py`):
```python
def require_admin(event: Dict[str, Any]) -> Dict[str, Any]:
    claims = _get_claims(event)
    config = load_config()
    groups = _parse_groups(claims)
    if config.admin_group not in groups:
        raise forbidden('admin_required')
    return claims
```

### 2.2 Database Security

**Strengths:**
- ✅ IAM authentication for RDS Proxy (no static passwords)
- ✅ TLS enforced (`sslmode='require'`)
- ✅ Token caching with proper expiry handling
- ✅ SQLAlchemy ORM prevents SQL injection
- ✅ Connection pool configured for Lambda (pool_size=1, max_overflow=0)

**Code Reference** (`backend/src/app/db.py`):
```python
return psycopg.connect(
    host=host,
    user=username,
    password=token,  # IAM token, not static password
    dbname=dbname,
    port=5432,
    sslmode='require',  # TLS enforced
)
```

### 2.3 Input Validation

**Strengths:**
- ✅ JSON body validation with proper error handling
- ✅ Pagination limit capped at 500 (prevents resource exhaustion)
- ✅ Cursor validation with type checking
- ✅ Query parameters parsed with explicit type conversion

**Code Reference** (`backend/src/app/http.py`):
```python
def parse_limit(event, default, max_limit=500):
    # ... validation logic ...
    return min(value, max_limit)  # Cap at max_limit
```

### 2.4 Error Handling

**Strengths:**
- ✅ Generic error responses (no stack traces in production)
- ✅ Error codes instead of detailed messages
- ✅ Exception logging includes request ID for debugging
- ✅ Proper exception chaining (`raise ... from exc`)

---

## 3. Infrastructure Security Analysis

### 3.1 CloudFormation Templates

#### Network (`network.yaml`)
- ✅ VPC with public/private subnet separation
- ✅ Private subnets for databases and Lambda
- ✅ VPC endpoints for AWS services (no internet traversal)
- ✅ Security groups with least-privilege rules

#### Database (`database.yaml`)
- ✅ Aurora PostgreSQL with encryption at rest (`StorageEncrypted: true`)
- ✅ IAM database authentication enabled
- ✅ Database in private subnets (`PubliclyAccessible: false`)
- ✅ Secrets Manager for credential storage
- ✅ RDS Proxy with `RequireTLS: true` and `IAMAuth: REQUIRED`

#### Authentication (`auth.yaml`)
- ✅ Cognito User Pool with email verification
- ✅ `PreventUserExistenceErrors: ENABLED` (prevents user enumeration)
- ✅ OAuth 2.0 authorization code flow
- ⚠️ MFA disabled (`MfaConfiguration: OFF`)

#### API (`backend-api.yaml`)
- ✅ JWT authorizer for admin routes
- ✅ Least-privilege IAM role for Lambda
- ⚠️ CORS allows wildcard origin by default

### 3.2 IAM Policies

**Lambda Execution Role Analysis:**
```yaml
Policies:
  - Effect: Allow
    Action: lambda:InvokeFunction
    Resource: ...function:${StackName}-*  # Scoped to stack
  - Effect: Allow
    Action: rds-db:connect
    Resource: ...dbuser:${ClusterResourceId}/${Username}  # Specific user
```

**Assessment**: Follows least-privilege principle. Permissions are scoped to specific resources.

---

## 4. Findings and Recommendations

### 4.1 High Priority (Recommended for Production)

| Finding | Risk | Recommendation |
|---------|------|----------------|
| CORS wildcard default | Medium | Restrict `CorsAllowedOrigins` to specific domains |
| MFA disabled | Medium | Enable MFA for sensitive applications |
| No WAF | Low | Add AWS WAF for API Gateway protection |

### 4.2 Medium Priority (Best Practices)

| Finding | Risk | Recommendation |
|---------|------|----------------|
| No rate limiting config | Low | Configure API Gateway throttling |
| No request body size limit | Low | Add content-length validation |
| Logging to CloudWatch only | Info | Consider aggregating logs (CloudWatch Logs Insights or external SIEM) |

### 4.3 Low Priority (Enhancements)

| Finding | Risk | Recommendation |
|---------|------|----------------|
| No API versioning headers | Info | Add `X-API-Version` response header |
| No request tracing | Info | Add X-Ray tracing for observability |
| Development params in repo | Info | Consider gitignoring `*-dev.json` files |

---

## 5. CORS Configuration Fix

For production deployments, update the CORS configuration:

**Current (dev.json):**
```json
{
  "ParameterKey": "CorsAllowedOrigins",
  "ParameterValue": "*"
}
```

**Recommended (prod.json):**
```json
{
  "ParameterKey": "CorsAllowedOrigins",
  "ParameterValue": "https://app.yourdomain.com,https://admin.yourdomain.com"
}
```

---

## 6. Compliance Considerations

### 6.1 OWASP Top 10 Coverage

| Risk | Status | Implementation |
|------|--------|----------------|
| A01:2021 Broken Access Control | ✅ | JWT auth, admin group verification |
| A02:2021 Cryptographic Failures | ✅ | TLS enforced, encryption at rest |
| A03:2021 Injection | ✅ | SQLAlchemy ORM, parameterized queries |
| A04:2021 Insecure Design | ✅ | Proper error handling, no data leaks |
| A05:2021 Security Misconfiguration | ⚠️ | CORS needs restriction for prod |
| A06:2021 Vulnerable Components | ✅ | Dependabot configured |
| A07:2021 Auth Failures | ✅ | Cognito with proper config |
| A08:2021 Integrity Failures | ✅ | JWT validation, no deserialization |
| A09:2021 Logging Failures | ✅ | CloudWatch logging enabled |
| A10:2021 SSRF | N/A | No user-controlled URL fetching |

---

## 7. Security Tools Configured

The following automated security scanning is now configured:

1. **Dependabot** - Weekly dependency updates with security alerts
2. **CodeQL** - Static analysis for Python
3. **Bandit** - Python security linter
4. **Checkov** - CloudFormation security scanning
5. **Gitleaks** - Secret detection
6. **Semgrep** - SAST with OWASP rules

---

## 8. Conclusion

This repository demonstrates **mature security practices** for a serverless AWS application:

- **No critical or high-severity vulnerabilities** were identified
- Infrastructure follows **AWS Well-Architected security principles**
- Code uses **proper authentication and input validation**
- **Automated security scanning** is now configured for continuous monitoring

### Action Items Before Production

1. Restrict CORS allowed origins
2. Enable Cognito MFA (optional but recommended)
3. Configure API Gateway throttling
4. Enable CloudTrail for audit logging
5. Consider AWS WAF for additional API protection

---

*This assessment was performed using Bandit, pip-audit, and manual code review.*
