# Admin Web Assessment

Status: **Ready for implementation**
Date: 2026-02-27
Scope: `apps/admin_web/**`

This document captures every improvement, refactoring opportunity, and best
practice gap found in the admin web application. Each item includes the problem,
affected files, and a concrete implementation specification so an agent can pick
up any item independently.

---

## Table of Contents

1. [F-01 Zero test coverage](#f-01-zero-test-coverage)
2. [F-02 Duplicated utility functions](#f-02-duplicated-utility-functions)
3. [F-03 Overloaded useAdminAssets hook](#f-03-overloaded-useadminassets-hook)
4. [F-04 No search debouncing](#f-04-no-search-debouncing)
5. [F-05 Missing App Router error boundaries](#f-05-missing-app-router-error-boundaries)
6. [F-06 AssetEditorPanel complexity](#f-06-asseteditorpanel-complexity)
7. [F-07 Unnecessary use client on presentational components](#f-07-unnecessary-use-client-on-presentational-components)
8. [F-08 Hardcoded asset type and content type](#f-08-hardcoded-asset-type-and-content-type)
9. [F-09 AuthProvider context not memoized](#f-09-authprovider-context-not-memoized)
10. [F-10 Overly defensive dual-case API parsing](#f-10-overly-defensive-dual-case-api-parsing)
11. [F-11 No class-name composition utility](#f-11-no-class-name-composition-utility)
12. [F-12 Native window.confirm for destructive actions](#f-12-native-windowconfirm-for-destructive-actions)
13. [F-13 Accessibility gaps](#f-13-accessibility-gaps)
14. [F-14 Config files use CommonJS](#f-14-config-files-use-commonjs)
15. [F-15 Unused lastCreatedUpload state](#f-15-unused-lastcreatedupload-state)

---

## F-01 Zero test coverage

**Priority:** Critical
**Effort:** Large

### Problem

There are no test files, no testing framework, no `tests/` directory, and no
testing dependencies in `package.json`. The `.cursorrules` mandate requires
updating tests when UI/API behavior changes.

### Affected files

- `apps/admin_web/package.json` (missing devDependencies)
- No `apps/admin_web/tests/` directory exists

### Implementation spec

1. Install Vitest and React Testing Library:

   ```
   npm install -D vitest @testing-library/react @testing-library/jest-dom
       @testing-library/user-event jsdom @vitejs/plugin-react
   ```

2. Create `apps/admin_web/vitest.config.ts`:

   ```ts
   import react from '@vitejs/plugin-react';
   import { defineConfig } from 'vitest/config';
   import path from 'path';

   export default defineConfig({
     plugins: [react()],
     resolve: {
       alias: { '@': path.resolve(__dirname, 'src') },
     },
     test: {
       environment: 'jsdom',
       globals: true,
       setupFiles: ['./tests/setup.ts'],
     },
   });
   ```

3. Create `apps/admin_web/tests/setup.ts`:

   ```ts
   import '@testing-library/jest-dom/vitest';
   ```

4. Add `"test": "vitest run"` to `package.json` scripts.

5. Create the following test files as a first pass (minimum coverage targets):

   | Test file | Tests for | Priority |
   |---|---|---|
   | `tests/lib/config.test.ts` | `getConfigErrors`, `getAdminApiBaseUrl`, `getAdminApiConfigError`, `getCognitoDomain` | High |
   | `tests/lib/auth.test.ts` | `getUserProfile` (JWT parsing), `ensureFreshTokens` (refresh logic), token storage helpers | High |
   | `tests/lib/api-admin-client.test.ts` | `adminApiRequest` success/error paths, `AdminApiError`, `extractErrorMessage`, `isAbortRequestError` | High |
   | `tests/lib/assets-api.test.ts` | `listAdminAssets`, `createAdminAsset`, response parsing, `uploadFileToPresignedUrl` | High |
   | `tests/lib/pkce.test.ts` | `generatePkcePair` output format | Medium |
   | `tests/hooks/use-admin-assets.test.ts` | Asset list loading, filter changes, create/update/delete flows, upload lifecycle, grant CRUD | High |
   | `tests/components/status-banner.test.tsx` | Renders all variants, title optional | Medium |
   | `tests/components/login-screen.test.tsx` | Email validation, code input toggle, Google button, disabled states | Medium |
   | `tests/components/admin/assets/asset-list-panel.test.tsx` | Renders table rows, filter inputs, load more, delete confirmation | Medium |
   | `tests/components/admin/assets/asset-editor-panel.test.tsx` | Create form validation, edit mode toggle, share link actions | Medium |
   | `tests/components/admin/assets/asset-grants-panel.test.tsx` | Grant form, grantee required toggle, revoke flow | Medium |

6. Mock `fetch` globally in the test setup for API tests. Mock
   `navigator.clipboard` for share link tests.

### Verification

Run `npm test` from `apps/admin_web/` and confirm all tests pass.

---

## F-02 Duplicated utility functions

**Priority:** High
**Effort:** Small

### Problem

The following functions are defined identically in multiple files:

| Function | Duplicated in |
|---|---|
| `toTitleCase(value: string): string` | `asset-list-panel.tsx`, `asset-grants-panel.tsx`, `asset-editor-panel.tsx` |
| `formatDate(value: string \| null): string` | `asset-list-panel.tsx`, `asset-grants-panel.tsx` |
| `isRecord(value: unknown): value is Record<string, unknown>` | `api-admin-client.ts`, `assets-api.ts` |
| `DeleteIcon` (SVG component) | `asset-list-panel.tsx`, `asset-editor-panel.tsx` |

### Implementation spec

1. Create `apps/admin_web/src/lib/format.ts`:

   ```ts
   export function toTitleCase(value: string): string {
     return value
       .split('_')
       .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
       .join(' ');
   }

   export function formatDate(value: string | null): string {
     if (!value) {
       return '\u2014';
     }
     const parsedDate = new Date(value);
     if (Number.isNaN(parsedDate.getTime())) {
       return value;
     }
     return parsedDate.toLocaleString();
   }
   ```

2. Create `apps/admin_web/src/lib/type-guards.ts`:

   ```ts
   export function isRecord(
     value: unknown
   ): value is Record<string, unknown> {
     return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
   }
   ```

3. Move `DeleteIcon` to `apps/admin_web/src/components/icons/action-icons.tsx`
   (the file already exists with `GoogleIcon` and `EmailIcon`). Also move
   `CopyIcon` and `RotateIcon` from `asset-editor-panel.tsx` there.

4. Update all consuming files to import from the shared modules. Remove the
   local duplicate definitions.

### Files to modify

- `apps/admin_web/src/lib/format.ts` (create)
- `apps/admin_web/src/lib/type-guards.ts` (create)
- `apps/admin_web/src/components/icons/action-icons.tsx` (add icons)
- `apps/admin_web/src/components/admin/assets/asset-list-panel.tsx` (remove local `toTitleCase`, `formatDate`, `DeleteIcon`; add imports)
- `apps/admin_web/src/components/admin/assets/asset-grants-panel.tsx` (remove local `toTitleCase`, `formatDate`; add imports)
- `apps/admin_web/src/components/admin/assets/asset-editor-panel.tsx` (remove local `toTitleCase`, `CopyIcon`, `RotateIcon`, `DeleteIcon`; add imports)
- `apps/admin_web/src/lib/api-admin-client.ts` (remove local `isRecord`; add import)
- `apps/admin_web/src/lib/assets-api.ts` (remove local `isRecord`; add import)

### Verification

Run `npm run lint` and `npm run build` from `apps/admin_web/`.

---

## F-03 Overloaded useAdminAssets hook

**Priority:** High
**Effort:** Medium

### Problem

`apps/admin_web/src/hooks/use-admin-assets.ts` is 431 lines and manages six
concerns via 20+ individual `useState` calls: asset list/pagination, asset CRUD,
file upload, selected asset tracking, grant list, and grant mutations. This makes
it hard to reason about, hard to test, and causes unnecessary re-renders.

### Implementation spec

1. Create `apps/admin_web/src/hooks/use-asset-list.ts`:
   - Move `filters`, `filtersRef`, `latestRefreshRequestIdRef`, `assets`,
     `nextCursor`, `isLoadingAssets`, `isLoadingMoreAssets`, `assetsError`,
     `selectedAssetId`, `selectedAsset` state.
   - Move `refreshAssets`, `loadMoreAssets`, `setQueryFilter`,
     `setVisibilityFilter`, `selectAsset`, `clearSelectedAsset`.
   - Export return type as `UseAssetListReturn`.

2. Create `apps/admin_web/src/hooks/use-asset-mutations.ts`:
   - Accept `refreshAssets` callback as a parameter.
   - Move `isSavingAsset`, `isDeletingAssetId`, `assetMutationError` state.
   - Move `createAssetEntry`, `updateAssetEntry`, `deleteAssetEntry`.
   - Move upload-related state: `uploadState`, `uploadError`, `pendingUpload`,
     `lastCreatedUpload`.
   - Move `retryPendingUpload`.
   - Export return type as `UseAssetMutationsReturn`.

3. Create `apps/admin_web/src/hooks/use-asset-grants.ts`:
   - Accept `selectedAssetId` as a parameter.
   - Move `grants`, `isLoadingGrants`, `grantsError`, `grantMutationError`,
     `isSavingGrant`, `isDeletingGrantId` state.
   - Move `refreshGrants`, `createGrantEntry`, `deleteGrantEntry`.
   - Move the `useEffect` that loads grants when `selectedAssetId` changes.
   - Export return type as `UseAssetGrantsReturn`.

4. Refactor `apps/admin_web/src/hooks/use-admin-assets.ts` to compose the three
   hooks and return the same public API (no consumer changes needed):

   ```ts
   export function useAdminAssets() {
     const assetList = useAssetList();
     const assetMutations = useAssetMutations(assetList.refreshAssets);
     const assetGrants = useAssetGrants(assetList.selectedAssetId);
     return { ...assetList, ...assetMutations, ...assetGrants };
   }
   ```

5. Within each sub-hook, consider converting related `useState` groups to a
   single `useReducer` for clearer state transitions. This is optional but
   recommended for `use-asset-mutations.ts` which has complex upload lifecycle
   states.

### Files to modify

- `apps/admin_web/src/hooks/use-asset-list.ts` (create)
- `apps/admin_web/src/hooks/use-asset-mutations.ts` (create)
- `apps/admin_web/src/hooks/use-asset-grants.ts` (create)
- `apps/admin_web/src/hooks/use-admin-assets.ts` (refactor to compose)

### Verification

Run `npm run build` from `apps/admin_web/`. Confirm existing behavior is
preserved (no consumer changes should be required since the return type is
unchanged).

---

## F-04 No search debouncing

**Priority:** High
**Effort:** Small

### Problem

In `apps/admin_web/src/hooks/use-admin-assets.ts`, the `setQueryFilter`
callback calls `refreshAssets` immediately on every keystroke. This fires an API
request per character typed. The race condition guard prevents stale display but
does not prevent the request flood.

### Implementation spec

1. Create `apps/admin_web/src/hooks/use-debounced-callback.ts`:

   ```ts
   import { useCallback, useEffect, useRef } from 'react';

   export function useDebouncedCallback<T extends (...args: never[]) => void>(
     callback: T,
     delayMs: number
   ): T {
     const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
     const callbackRef = useRef(callback);

     useEffect(() => {
       callbackRef.current = callback;
     }, [callback]);

     useEffect(() => {
       return () => {
         if (timeoutRef.current !== null) {
           clearTimeout(timeoutRef.current);
         }
       };
     }, []);

     return useCallback(
       ((...args: Parameters<T>) => {
         if (timeoutRef.current !== null) {
           clearTimeout(timeoutRef.current);
         }
         timeoutRef.current = setTimeout(() => {
           callbackRef.current(...args);
           timeoutRef.current = null;
         }, delayMs);
       }) as T,
       [delayMs]
     );
   }
   ```

2. In the asset list hook (or `use-admin-assets.ts` if F-03 is not done yet),
   wrap the `refreshAssets` call inside `setQueryFilter` with the debounced
   callback:

   ```ts
   const debouncedRefresh = useDebouncedCallback(
     (nextFilters: Partial<Filters>) => {
       void refreshAssets(nextFilters);
     },
     350
   );

   const setQueryFilter = useCallback(
     (query: string) => {
       const nextFilters = { ...filtersRef.current, query };
       filtersRef.current = nextFilters;
       setFilters(nextFilters);
       debouncedRefresh(nextFilters);
     },
     [debouncedRefresh]
   );
   ```

3. Keep `setVisibilityFilter` non-debounced (dropdown change is a single
   discrete event).

### Files to modify

- `apps/admin_web/src/hooks/use-debounced-callback.ts` (create)
- `apps/admin_web/src/hooks/use-admin-assets.ts` (or `use-asset-list.ts` if
  F-03 is done)

### Verification

Run `npm run build`. Manual test: type quickly in the search box and confirm
only one API call fires after typing stops (inspect via browser DevTools Network
tab).

---

## F-05 Missing App Router error boundaries

**Priority:** Medium
**Effort:** Small

### Problem

No `error.tsx`, `not-found.tsx`, or `loading.tsx` files exist under
`apps/admin_web/src/app/`. Unhandled runtime errors show the default Next.js
error overlay with no recovery. There is no custom 404 page.

### Implementation spec

1. Create `apps/admin_web/src/app/error.tsx`:

   ```tsx
   'use client';

   import { StatusBanner } from '@/components/status-banner';
   import { Button } from '@/components/ui/button';

   export default function GlobalError({
     error,
     reset,
   }: {
     error: Error & { digest?: string };
     reset: () => void;
   }) {
     return (
       <main className='mx-auto flex min-h-screen max-w-lg items-center px-6'>
         <div className='w-full space-y-4'>
           <StatusBanner variant='error' title='Something went wrong'>
             {error.message || 'An unexpected error occurred.'}
           </StatusBanner>
           <Button type='button' onClick={reset} className='w-full'>
             Try again
           </Button>
         </div>
       </main>
     );
   }
   ```

2. Create `apps/admin_web/src/app/not-found.tsx`:

   ```tsx
   import { StatusBanner } from '@/components/status-banner';

   export default function NotFound() {
     return (
       <main className='mx-auto flex min-h-screen max-w-lg items-center px-6'>
         <StatusBanner variant='info' title='Page not found'>
           The page you requested does not exist. Return to the admin dashboard.
         </StatusBanner>
       </main>
     );
   }
   ```

### Files to create

- `apps/admin_web/src/app/error.tsx`
- `apps/admin_web/src/app/not-found.tsx`

### Verification

Run `npm run build` from `apps/admin_web/`.

---

## F-06 AssetEditorPanel complexity

**Priority:** Medium
**Effort:** Medium

### Problem

`apps/admin_web/src/components/admin/assets/asset-editor-panel.tsx` is 660
lines. It combines asset form editing, file upload, and the entire share link
management UI (copy, rotate, revoke, domain policy) in one component with
multiple inline SVG icons.

### Implementation spec

1. Move `CopyIcon`, `RotateIcon`, `DeleteIcon` to
   `apps/admin_web/src/components/icons/action-icons.tsx` (same as F-02 step 3).

2. Extract `apps/admin_web/src/components/admin/assets/asset-share-link-section.tsx`:
   - Move all share link state: `isCopyingLink`, `isRotatingLink`,
     `isRevokingLink`, `isSavingLinkPolicy`, `linkError`, `linkNotice`,
     `isLinkCopied`, `allowedDomainsInput`, `copiedStateTimeoutRef`.
   - Move handlers: `handleCopyAssetLink`, `handleRotateAssetLink`,
     `handleSaveLinkPolicy`, `handleRevokeAssetLink`, `buildSharePolicyInput`.
   - Move the `useEffect` that loads share link policy on asset change.
   - Move helper: `parseAllowedDomainList`.
   - Props: `selectedAsset: AdminAsset`.
   - This section renders the "Links" buttons and "Share-link domain allowlist"
     textarea.

3. Optionally extract form validation logic into a small
   `validateAssetForm(formState, selectedFile, isEditMode)` function in the same
   file or in `apps/admin_web/src/lib/validate.ts`.

4. The resulting `asset-editor-panel.tsx` should contain only the form fields,
   file upload button, and compose `<AssetShareLinkSection>` when in edit mode.

### Files to modify

- `apps/admin_web/src/components/admin/assets/asset-share-link-section.tsx`
  (create)
- `apps/admin_web/src/components/admin/assets/asset-editor-panel.tsx` (simplify)
- `apps/admin_web/src/components/icons/action-icons.tsx` (add icons, shared
  with F-02)

### Verification

Run `npm run lint` and `npm run build` from `apps/admin_web/`.

---

## F-07 Unnecessary use client on presentational components

**Priority:** Medium
**Effort:** Small

### Problem

All 19 component files are marked `'use client'`, including pure presentational
components that contain no state, no effects, and no event handlers. The
`.cursorrules` mandate is: "Prefer server components by default; minimize
`use client`."

### Components that should NOT have `'use client'`

| File | Reason it can be a server component |
|---|---|
| `src/components/status-banner.tsx` | Pure props-to-JSX, no hooks |
| `src/components/ui/card.tsx` | Pure props-to-JSX, no hooks |
| `src/components/ui/label.tsx` | Pure props-to-JSX, no hooks |

### Components that MUST keep `'use client'`

All others use hooks, event handlers, or browser APIs.

### Implementation spec

1. Remove the `'use client';` directive from:
   - `apps/admin_web/src/components/status-banner.tsx`
   - `apps/admin_web/src/components/ui/card.tsx`
   - `apps/admin_web/src/components/ui/label.tsx`

2. Confirm these components are not using any client-only imports or hooks
   (they do not).

### Files to modify

- `apps/admin_web/src/components/status-banner.tsx`
- `apps/admin_web/src/components/ui/card.tsx`
- `apps/admin_web/src/components/ui/label.tsx`

### Verification

Run `npm run build` from `apps/admin_web/`. If the build fails because a parent
client component boundary is required, re-add `'use client'` to only those that
fail. (Under `output: 'export'` mode this should not be an issue.)

---

## F-08 Hardcoded asset type and content type

**Priority:** Medium
**Effort:** Small

### Problem

In `apps/admin_web/src/components/admin/assets/assets-page.tsx`, `assetType`
and `contentType` are hardcoded as `'document'` and `'application/pdf'` in the
`onCreate` and `onUpdate` callbacks (lines 72-73 and 84-85). These values are
scattered across two callback closures rather than defined in one place.

### Implementation spec

1. Create named constants in
   `apps/admin_web/src/components/admin/assets/assets-page.tsx` or in a shared
   config:

   ```ts
   const DEFAULT_ASSET_TYPE = 'document' as const;
   const DEFAULT_CONTENT_TYPE = 'application/pdf' as const;
   ```

2. Use the constants in both `onCreate` and `onUpdate` callbacks:

   ```ts
   assetType: DEFAULT_ASSET_TYPE,
   contentType: DEFAULT_CONTENT_TYPE,
   ```

3. Similarly, in `use-admin-assets.ts`, `refreshAssets` and `loadMoreAssets`
   both hardcode `assetType: 'document'` (lines 104 and 147). Extract this to
   a constant at the top of the file:

   ```ts
   const ASSET_LIST_TYPE_FILTER = 'document' as const;
   ```

### Files to modify

- `apps/admin_web/src/components/admin/assets/assets-page.tsx`
- `apps/admin_web/src/hooks/use-admin-assets.ts`

### Verification

Run `npm run build` from `apps/admin_web/`.

---

## F-09 AuthProvider context not memoized

**Priority:** Medium
**Effort:** Small

### Problem

In `apps/admin_web/src/components/auth-provider.tsx`, the context `value` object
is recreated on every render (line 204-217). The handler functions `login`,
`logout`, `sendPasswordlessCode`, `verifyPasswordlessCode`, and
`resetPasswordless` are not wrapped in `useCallback`, so they are new references
each render. This forces all `useAuth()` consumers to re-render whenever any
piece of AuthProvider state changes.

### Implementation spec

1. Wrap handler functions in `useCallback`:

   ```ts
   const login = useCallback(async (options?: LoginOptions) => {
     await startLogin(options);
   }, []);

   const logout = useCallback(() => {
     startLogout();
   }, []);

   const sendPasswordlessCode = useCallback(async (email: string) => {
     // existing body unchanged
   }, []);

   const verifyPasswordlessCode = useCallback(async (code: string) => {
     // existing body unchanged — uses cognitoUser from state,
     // so add cognitoUser to dependency array
   }, [cognitoUser]);

   const resetPasswordless = useCallback(() => {
     setPasswordlessStatus('idle');
     setPasswordlessError('');
     setPasswordlessEmail('');
     setCognitoUser(null);
   }, []);
   ```

2. Memoize the context value:

   ```ts
   const value = useMemo<AuthContextValue>(
     () => ({
       status, user, configErrors, error, login, logout,
       passwordlessStatus, passwordlessError, passwordlessEmail,
       sendPasswordlessCode, verifyPasswordlessCode, resetPasswordless,
     }),
     [
       status, user, configErrors, error, login, logout,
       passwordlessStatus, passwordlessError, passwordlessEmail,
       sendPasswordlessCode, verifyPasswordlessCode, resetPasswordless,
     ]
   );
   ```

### Files to modify

- `apps/admin_web/src/components/auth-provider.tsx`

### Verification

Run `npm run build` from `apps/admin_web/`.

---

## F-10 Overly defensive dual-case API parsing

**Priority:** Medium
**Effort:** Medium

### Problem

`apps/admin_web/src/lib/assets-api.ts` (480 lines) uses a
`pickFirst(record, ['camelCase', 'snake_case'])` pattern for every field when
parsing API responses. The OpenAPI-generated types in
`admin-api.generated.ts` define that the API uses **snake_case only**. The
dual-case parsing:
- Masks potential API contract changes
- Adds significant code volume
- Contradicts the typed OpenAPI contract

### Implementation spec

1. Replace all `pickFirst(value, ['camelCase', 'snake_case'])` calls with
   direct property access using only the documented snake_case keys:

   Before:
   ```ts
   id: asString(pickFirst(value, ['id'])),
   title: asString(pickFirst(value, ['title'])) ?? 'Untitled asset',
   assetType: parseAssetType(pickFirst(value, ['assetType', 'asset_type'])),
   s3Key: asString(pickFirst(value, ['s3Key', 's3_key'])) ?? '',
   ```

   After:
   ```ts
   id: asString(value.id),
   title: asString(value.title) ?? 'Untitled asset',
   assetType: parseAssetType(value.asset_type),
   s3Key: asString(value.s3_key) ?? '',
   ```

2. Remove the `pickFirst` helper function entirely.

3. Apply the same simplification to `parseGrant`, `extractListItems`,
   `extractHeaders`, and `parseAssetShareLink`.

4. Update the function signatures to accept typed parameters using the
   generated API types where possible, instead of `unknown`.

### Files to modify

- `apps/admin_web/src/lib/assets-api.ts`

### Verification

Run `npm run lint` and `npm run build` from `apps/admin_web/`.

---

## F-11 No class-name composition utility

**Priority:** Low
**Effort:** Small

### Problem

Components build CSS class strings via template literal concatenation:

```ts
className={`${baseStyles} ${variantStyles[variant]} ${sizeStyles[size]} ${className}`}
```

This is fragile (double spaces, no conditional support, no deduplication).

### Implementation spec

1. Install `clsx`:

   ```
   npm install clsx
   ```

2. Update `apps/admin_web/src/components/ui/button.tsx`:

   ```ts
   import { clsx } from 'clsx';

   export function Button({
     variant = 'primary',
     size = 'md',
     className,
     ...props
   }: ButtonProps) {
     return (
       <button
         className={clsx(baseStyles, variantStyles[variant], sizeStyles[size], className)}
         {...props}
       />
     );
   }
   ```

3. Apply the same pattern to all UI primitives that concatenate class strings:
   - `apps/admin_web/src/components/ui/input.tsx`
   - `apps/admin_web/src/components/ui/select.tsx`
   - `apps/admin_web/src/components/ui/textarea.tsx`
   - `apps/admin_web/src/components/ui/label.tsx`
   - `apps/admin_web/src/components/ui/card.tsx`
   - `apps/admin_web/src/components/ui/file-upload-button.tsx`
   - `apps/admin_web/src/components/status-banner.tsx`

4. Replace manual `.filter(Boolean).join(' ')` patterns in
   `file-upload-button.tsx` with `clsx(...)`.

### Files to modify

- `apps/admin_web/package.json` (add `clsx`)
- All files listed in step 3 above

### Verification

Run `npm run lint` and `npm run build` from `apps/admin_web/`.

---

## F-12 Native window.confirm for destructive actions

**Priority:** Low
**Effort:** Medium

### Problem

Delete and revoke operations use `window.confirm()`, which is a blocking native
dialog that cannot be styled and is inconsistent with the app's design.

### Affected call sites

| File | Usage |
|---|---|
| `asset-list-panel.tsx` line 89 | Delete asset confirmation |
| `asset-grants-panel.tsx` line 96 | Delete grant confirmation |
| `asset-editor-panel.tsx` line 347 | Rotate share link confirmation |
| `asset-editor-panel.tsx` line 411 | Revoke share link confirmation |

### Implementation spec

1. Create `apps/admin_web/src/components/ui/confirm-dialog.tsx`:
   - Accept props: `open`, `title`, `description`, `confirmLabel`,
     `cancelLabel`, `variant` (`'danger' | 'default'`), `onConfirm`,
     `onCancel`.
   - Render a modal overlay with backdrop, using existing `Card` and `Button`.
   - Trap focus inside the dialog. Close on Escape.
   - Use `<dialog>` element or `role="alertdialog"` for accessibility.

2. Create a `useConfirmDialog` hook or a simpler callback-based pattern that
   each panel can use:

   ```ts
   const [confirmState, requestConfirm] = useConfirmDialog();
   // In JSX: <ConfirmDialog {...confirmState} />
   // In handler: const confirmed = await requestConfirm({ title, description });
   ```

3. Replace all four `window.confirm()` call sites with the custom dialog.

### Files to modify

- `apps/admin_web/src/components/ui/confirm-dialog.tsx` (create)
- `apps/admin_web/src/components/admin/assets/asset-list-panel.tsx`
- `apps/admin_web/src/components/admin/assets/asset-grants-panel.tsx`
- `apps/admin_web/src/components/admin/assets/asset-editor-panel.tsx`

### Verification

Run `npm run build` from `apps/admin_web/`. Manual test: confirm destructive
actions show the custom modal.

---

## F-13 Accessibility gaps

**Priority:** Low
**Effort:** Small

### Problem

- No skip-to-content navigation link in the `AppShell`.
- Asset table rows are clickable `<tr>` elements using `onClick` and
  `cursor-pointer` but lack proper keyboard interaction (no `tabIndex`, no
  `onKeyDown` for Enter/Space).
- The mobile hamburger button uses text characters (`×` and `☰`) instead of
  accessible SVG icons.

### Implementation spec

1. Add skip-nav link in `apps/admin_web/src/components/app-shell.tsx`:

   ```tsx
   <a
     href='#main-content'
     className='sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-white focus:px-4 focus:py-2 focus:text-sm focus:shadow-lg'
   >
     Skip to main content
   </a>
   ```

   And add `id="main-content"` to the `<main>` element.

2. Make asset table rows keyboard-accessible in
   `apps/admin_web/src/components/admin/assets/asset-list-panel.tsx`:

   ```tsx
   <tr
     key={asset.id}
     tabIndex={0}
     role='row'
     onKeyDown={(event) => {
       if (event.key === 'Enter' || event.key === ' ') {
         event.preventDefault();
         onSelectAsset(asset.id);
       }
     }}
     // ...existing props
   >
   ```

3. Replace text hamburger characters with an SVG icon in `app-shell.tsx`.

### Files to modify

- `apps/admin_web/src/components/app-shell.tsx`
- `apps/admin_web/src/components/admin/assets/asset-list-panel.tsx`

### Verification

Run `npm run build` from `apps/admin_web/`. Tab through the page and confirm
skip-nav link appears on focus, and table rows are selectable via keyboard.

---

## F-14 Config files use CommonJS

**Priority:** Low
**Effort:** Trivial

### Problem

`postcss.config.js` and `eslint.config.js` use `module.exports` while
`tailwind.config.ts` uses ESM. The README documents this as a known temporary
ESLint compatibility shim.

### Implementation spec

This should only be done **after** the upstream `eslint-config-next` ships
stable ESLint 10 support (tracked in README). When that happens:

1. Convert `apps/admin_web/eslint.config.js` to ESM with `export default`.
2. Convert `apps/admin_web/postcss.config.js` to ESM (rename to
   `postcss.config.mjs` or add `"type": "module"` to package.json).
3. Remove the `@eslint/compat` dependency and the `typescript-eslint` override
   from `package.json`.

### Files to modify (when ready)

- `apps/admin_web/eslint.config.js`
- `apps/admin_web/postcss.config.js`
- `apps/admin_web/package.json`

### Verification

Run `npm run lint` and `npm run build` from `apps/admin_web/`.

---

## F-15 Unused lastCreatedUpload state

**Priority:** Low
**Effort:** Trivial

### Problem

In `apps/admin_web/src/hooks/use-admin-assets.ts`, `lastCreatedUpload` state
and its `clearLastCreatedUpload` setter are tracked and returned (lines 63, 221,
404, 429) but never consumed by any component.

### Implementation spec

**Option A — Remove it:**

1. Remove `lastCreatedUpload` state (`useState`, all `setLastCreatedUpload`
   calls).
2. Remove `clearLastCreatedUpload` from the return object.
3. Remove `lastCreatedUpload` from the return object.

**Option B — Use it:**

If the intent is to display upload URL details (e.g., expiry time) to the admin
user, wire `lastCreatedUpload` into the `AssetEditorPanel` UI.

### Files to modify

- `apps/admin_web/src/hooks/use-admin-assets.ts`

### Verification

Run `npm run build` from `apps/admin_web/`.

---

## Implementation order recommendation

For an agent picking up this work, the recommended order balances impact and
dependency:

1. **F-02** (duplicated utils) — Small, no dependencies, cleans up for later
   work.
2. **F-07** (remove unnecessary `'use client'`) — Trivial, independent.
3. **F-08** (hardcoded constants) — Trivial, independent.
4. **F-09** (AuthProvider memoization) — Small, independent.
5. **F-15** (unused state) — Trivial, independent.
6. **F-04** (search debouncing) — Small, independent.
7. **F-05** (error boundaries) — Small, independent.
8. **F-11** (clsx) — Small, independent.
9. **F-13** (accessibility) — Small, independent.
10. **F-06** (editor panel extraction) — Medium, benefits from F-02 being done.
11. **F-03** (hook decomposition) — Medium, benefits from F-04 and F-15 being
    done.
12. **F-10** (API parsing simplification) — Medium, benefits from F-02 being
    done.
13. **F-01** (test coverage) — Large, benefits from all refactoring being done
    first so tests cover the final code shape.
14. **F-12** (confirm dialog) — Medium, independent but lowest priority.
15. **F-14** (CommonJS config) — Blocked on upstream ESLint 10 support.

Each item is self-contained and can be implemented as an independent commit.
