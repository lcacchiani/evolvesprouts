# Code Review: PR #987 — Admin Contacts Section

**Branch:** `cursor/contacts-admin-section-ea6f`
**Reviewer branch:** `cursor/admin-contacts-section-09fa`
**Date:** 2026-03-31

## Overall Assessment

The implementation closely follows the approved plan and all four question
answers have been respected. The full-stack scope (backend routes, CDK wiring,
OpenAPI, docs, admin UI, tests) is covered.

---

## Plan Answer Compliance

| # | Question / Decision | Status | Evidence |
|---|---|---|---|
| 1 | Exclude vendors from Organisations | PASS | `OrganizationRepository.list_crm_organizations()` filters `!= VENDOR`; `_parse_relationship_type_crm` rejects vendor with clear error; frontend hook excludes 'vendor' from `CRM_RELATIONSHIP_OPTIONS` |
| 2 | Soft archive only | PASS | All three entities toggle `archived_at` via the `active` boolean field; no hard DELETE for contacts/families/organizations themselves (only junction-table member rows use `session.delete()`) |
| 3 | Tags and locations | PASS | `CrmTagPicker` multi-select backed by `GET /contacts/tags`; location dropdown from `listAllLocations()`; both contacts, families, and organisations support `tag_ids` and `location_id` |
| 4 | Match code paths | PASS | REST paths use American `/v1/admin/organizations`; UI labels use British "Organisations" |

## Mandatory Checklist (.cursorrules)

| Requirement | Status | Notes |
|---|---|---|
| NAV_ITEMS alphabetical in page.tsx | PASS | Assets, Contacts, Finance, Sales, Services |
| AdminTabStrip for sub-views | PASS | Contacts, Families, Organisations |
| Inline editor (AdminEditorCard) above table | PASS | All three panels |
| PaginatedTableCard + AdminDataTable | PASS | All three panels with search + status filter toolbar |
| No modals for main CRUD | PASS | ConfirmDialog only for destructive member removal |
| Cancel left of primary in edit mode | PASS | All three panels |
| CDK route wiring (api-stack.ts) | PASS | All CRM paths registered |
| OpenAPI (admin.yaml) | PASS | All paths + schemas + enums present |
| Lambda catalog (lambdas.md) | PASS | Updated with CRM endpoints |
| Generated types regenerated | PASS | admin-api.generated.ts updated (+891 lines) |
| No print() in production code | PASS | Verified across all new backend files |
| No hardcoded secrets/tokens | PASS | |
| Python files under 500 lines | PASS | Largest is admin_contacts.py at 371 lines |
| No inline style in JSX | PASS | |
| Tests for web behaviour changes | PASS | contacts-page.test.tsx + backend route tests |

---

## Issues Found

### Must Fix

**1. `.cursorrules` nav list not updated (line 268)**

The `.cursorrules` file states:

> Top-level navigation must list areas alphabetically: Assets, Finance, Sales,
> Services.

The implementation correctly adds Contacts to `page.tsx`, but `.cursorrules`
line 268 was not updated to include Contacts in the canonical list. This will
cause drift between the rule and the implementation, and future agents or
developers may flag or revert it.

**2. `assert loaded is not None` in production Lambda code**

The PR description mentions replacing assert checks with DatabaseError for
Bandit B101, but the committed code still uses bare `assert`:

- `admin_contacts.py` lines 255, 357
- `admin_families.py` lines 187, 240, 292, 319
- `admin_organizations_crm.py` lines 224, 288, 324, 351

The existing `admin_vendors.py` handler does not use `assert` after commit. It
serializes directly. Using `assert` in production Lambda code is risky because
Python `-O` mode strips assertions. Replace with explicit `if loaded is None:
raise AppError(...)` or follow the vendor pattern.

### Should Fix

**3. `_request_id()` helper duplicated in 3 files**

The identical `_request_id(event)` function appears in `admin_contacts.py`,
`admin_families.py`, and `admin_organizations_crm.py`. Extract to
`admin_crm_helpers.py`.

**4. `_parse_relationship_type()` duplicated**

The same helper with identical implementation exists in both
`admin_contacts.py` and `admin_families.py`. The organizations variant is
different (rejects vendor), but the contacts/families version could be shared
from `admin_crm_helpers.py`.

**5. `humanizeEnum()` duplicated across 3 panels**

`contacts-panel.tsx`, `families-panel.tsx`, and `organizations-panel.tsx` each
define an identical `humanizeEnum` function. Extract to `@/lib/format.ts` which
already has `formatEnumLabel` and `toTitleCase`.

### Non-blocking / Consider

**6. Contacts and Families REL_TYPES include 'vendor'**

The contacts and families panels include 'vendor' in the relationship type
dropdown, while the organizations panel explicitly excludes it. The backend
accepts it for contacts and families (no server-side rejection). This is
arguably a product design decision (a contact can be a vendor contact), but
worth confirming this is intended, since answer 1 ("exclude vendors") was
scoped to the organizations tab.

**7. Test coverage depth**

The test suite covers routing dispatch and tab switching, but does not test
CRUD operations (create/update), validation error handling, filter debouncing,
or pagination. Consider adding focused tests for:

- Create with validation errors (duplicate email / instagram)
- Update with partial fields
- Active / archived filter behavior
- Family / org member add / remove flow

---

## Architecture / Pattern Notes

- The hook pattern (`usePaginatedList` plus entity-specific wrappers) is clean
  and consistent with the existing vendors pattern.
- Shared serializers (`admin_crm_serializers.py`) and helpers
  (`admin_crm_helpers.py`) are a good factoring choice.
- The `CrmTagPicker` checkbox fieldset is simple and functional; may want a
  search filter if tag count grows.
- The contact options dropdown in families/organizations panels is populated
  from the contacts list. If the contact list is large this could become a
  performance concern. A future improvement could be an async search or
  autocomplete.

## Summary

The implementation is solid and well-structured. The two must-fix items are
straightforward: update `.cursorrules` to reflect the new nav item and replace
`assert` with proper error handling in the backend handlers. The duplication
issues (items 3 through 5) are minor cleanup that can be addressed in a
follow-up commit.
