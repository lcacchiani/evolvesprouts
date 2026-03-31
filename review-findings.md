# Code Review: `cursor/eventbrite-event-creation-ffbf` (admin_web)

Standards compliance review against `.cursorrules` MANDATORY rules.

---

## ISSUES FOUND

### Issue 1: Imports placed after function definitions

**Rule violated:** General code style — "Write concise, readable, and maintainable code."

**Files:**
- `apps/admin_web/src/components/admin/contacts/families-panel.tsx` (lines 1–33)
- `apps/admin_web/src/components/admin/contacts/organizations-panel.tsx` (lines 1–33)

**Details:** Both files define a utility function *before* the import block. While technically valid due to ES module hoisting, this violates standard TypeScript/JavaScript conventions and may conflict with linting rules (e.g., `import/first`).

In `families-panel.tsx`:
```typescript
'use client';

import { useMemo, useState } from 'react';

function contactEligibleForFamilyMember(
  contact: { id: string; family_ids: string[]; organization_ids: string[] },
  selectedFamilyId: string | null
): boolean {
  // ...
}

import type { useAdminCrmFamilies } from '@/hooks/use-admin-crm-families';
// ... rest of imports
```

Same pattern in `organizations-panel.tsx` with `contactEligibleForOrgMember`.

**Fix:** Move the utility function after all imports.

---

### Issue 2: Hardcoded `'HKD'` currency instead of using `getAdminDefaultCurrencyCode()`

**Rule violated:** Constraints — "Categorically ban hardcoded environment-specific values... Derive them from parameters, environment variables, or repository config sources."

**File:** `apps/admin_web/src/components/admin/services/instance-detail-panel.tsx`

**Details:** Multiple occurrences of hardcoded `'HKD'` when the codebase provides `getAdminDefaultCurrencyCode()` in `@/lib/config` (backed by `NEXT_PUBLIC_ADMIN_DEFAULT_CURRENCY`):

| Line | Code |
|------|------|
| ~75 | `defaultCurrency: td.defaultCurrency ?? 'HKD'` |
| ~122 | `defaultCurrency: instance.trainingDetails?.currency ?? 'HKD'` |
| ~142 | `defaultCurrency: instance.consultationDetails?.currency ?? 'HKD'` |
| ~213 | `currency: trainingForm.defaultCurrency \|\| 'HKD'` |
| ~223 | `currency: 'HKD'` (event ticket tier) |
| ~231 | `currency: consultationForm.defaultCurrency \|\| 'HKD'` |

**Fix:** Replace `'HKD'` with `getAdminDefaultCurrencyCode()` to respect the configured default currency, matching the pattern already used in `expenses-editor-panel.tsx`.

---

### Issue 3: Contacts/Families/Organizations listing tables missing Operations column

**Rule violated:** Admin Web shell and layout standard (MANDATORY) — "then the table with a trailing Operations column (right-aligned header) for row actions."

**Files:**
- `apps/admin_web/src/components/admin/contacts/contacts-panel.tsx` (~lines 668–695)
- `apps/admin_web/src/components/admin/contacts/families-panel.tsx` (~lines 420–444)
- `apps/admin_web/src/components/admin/contacts/organizations-panel.tsx` (~lines 446–472)

**Details:** The main listing tables for contacts, families, and organizations do not include a trailing "Operations" column. The standard requires listing blocks to include an Operations column (right-aligned header) for row actions. Even if the current design has no per-row destructive actions, the structural pattern should be followed for consistency and future extensibility.

Note: The families and organizations *member sub-tables* (inside the editor card) DO correctly include an Operations column with a Remove button. The venues panel also correctly includes an Operations column with a delete action.

**Severity:** Medium — this is a structural pattern compliance issue. If the product intent is to never have per-row actions on these listings, this may be acceptable but deviates from the stated MANDATORY pattern.

---

## ITEMS PASSING REVIEW

### 1. No inline `style={...}` or `CSSProperties` usage
**PASS.** Searched the entire diff — zero instances of `style=` attributes or `CSSProperties` references in any new or modified file. All styling uses Tailwind CSS classes.

### 2. No inline SVG markup in components
**PASS.** No `<svg>` elements found in the diff. Icon usage goes through the SVGR-based `DeleteIcon` from `@/components/icons/action-icons`.

### 3. Contacts section follows CRUD UX pattern (inline editor, not modals)
**PASS.** All three panels (`ContactsPanel`, `FamiliesPanel`, `OrganizationsPanel`) implement:
- `AdminEditorCard` for inline create/edit
- Row click switches between create and edit modes via `editorMode` state
- Cancel button in edit mode returns to create mode
- No modals/dialogs/sheets/drawers for CRUD operations
- `ConfirmDialog` used only for destructive member removal (correct usage per rules)

### 4. New panels use `AdminEditorCard`, `AdminDataTable`, `PaginatedTableCard`
**PASS.** All new panels correctly compose:
- `AdminEditorCard` with title, description, and actions row
- `PaginatedTableCard` with toolbar (search/filters), loading states, and pagination
- `AdminDataTable` / `AdminDataTableHead` / `AdminDataTableBody` for table structure
- `VenuesPanel` uses a `<form>` with stable `id` and `form=` attribute on the submit button (matching the rules for forms inside `AdminEditorCard`)

### 5. Top-level nav alphabetically ordered
**PASS.** In `apps/admin_web/src/app/page.tsx`, `NAV_ITEMS` is: Assets, Contacts, Finance, Sales, Services — correctly alphabetical. Default section after sign-in is `'finance'` as required.

### 6. View switchers use `AdminTabStrip`
**PASS.**
- `contacts-page.tsx` uses `AdminTabStrip` for Contacts/Families/Organisations tabs
- `services-header.tsx` uses `AdminTabStrip` for Service Catalogue/Instances/Discount Codes/Venues tabs

### 7. No hardcoded secrets, API keys, passwords, tokens
**PASS.** No secrets or tokens found in app code. API base URL is derived from environment variable `NEXT_PUBLIC_API_BASE_URL` via `config.ts`. The README example URL (`https://api.evolvesprouts.com`) is pre-existing documentation (not changed in this diff) and is purely illustrative.

### 8. Generated types not hand-edited
**PASS (with caveat).** The changes to `admin-api.generated.ts` (~1654 lines of diff) add new paths (`/v1/admin/locations/geocode`, `/v1/admin/instructors`, CRM endpoints) and schemas (CRM contacts, families, organizations, tags, geographic areas, geocoding). The structural patterns are fully consistent with OpenAPI code generation output. Without running `npm run generate:admin-api-types` to verify byte-for-byte, the additions appear properly generated.

**Recommendation:** Confirm the types were regenerated by running:
```bash
npm run generate:admin-api-types
npm run check:admin-api-types
```

### 9. `use client` usage
**PASS.** All `'use client'` directives are justified:
- Component files using React hooks (`useState`, `useEffect`, `useMemo`) or interactive event handlers correctly declare `'use client'`
- Hook files follow the existing codebase convention of declaring `'use client'`
- Pure utility/type files (`crm-api.ts`, `crm.ts`, `crm-relationship.ts`, `api-payload.ts`, `format.ts`) correctly omit `'use client'`
- The new `admin-inline-error.tsx` correctly omits `'use client'` (pure render, no hooks)

---

## SUMMARY

| Check | Result | Issues |
|-------|--------|--------|
| Inline `style={...}` / `CSSProperties` | PASS | 0 |
| Inline SVG markup | PASS | 0 |
| CRUD UX pattern (inline editor) | PASS | 0 |
| AdminEditorCard/AdminDataTable/PaginatedTableCard | PASS | 0 |
| Top-level nav alphabetical | PASS | 0 |
| View switchers use AdminTabStrip | PASS | 0 |
| Hardcoded env-specific values | **ISSUE** | 1 (HKD currency) |
| Generated types not hand-edited | PASS* | 0 (verify with tooling) |
| Unnecessary `use client` | PASS | 0 |
| Import ordering | **ISSUE** | 1 (2 files) |
| Operations column in listing tables | **ISSUE** | 1 (3 files) |

**Total issues: 3** (1 hardcoded value, 1 import ordering in 2 files, 1 missing Operations column in 3 files)
