# Plan: CTA form prefill / auto-skip on Free Guides & Resources page

## Problem

The **Free Guides & Resources** page (`/[locale]/free-guides-and-resources`)
renders two `MediaForm` instances that each collect **name + email**:

1. `FreeResourcesForGentleParenting` section — hero-style resource card
   (`analyticsSectionId='resources'`).
2. `FreeGuidesAndResourcesLibrary` section — the `patience-free-guide` library
   card (`analyticsSectionId='free-guides-library'`).

Each instance currently has fully isolated local `useState` for `firstName`,
`email`, visibility, and submission status. After a user fills and submits one
form, the other form still shows the CTA button and asks for name + email
again.

## Goal

Once a user fills and submits a MediaForm on the page, every other MediaForm
on the same page should **skip the form entirely** and show the success state
(download confirmation) directly — no second form open, no second captcha, no
second submission.

## Approach: page-scoped React Context

Introduce a lightweight React Context (`MediaFormProvider`) that holds a
boolean flag indicating whether **any** MediaForm on the page has been
submitted successfully. When the flag is `true`, every MediaForm instance
renders its success state immediately instead of the CTA button.

- **No `localStorage` / `sessionStorage`** — data stays in React state for the
  current page session only. No PII persistence risk.
- **No extra API calls** — the second form does not re-submit; it just shows
  the existing success title + body.

## Files to create

### 1. `apps/public_www/src/components/sections/shared/media-form-context.tsx`

- `'use client'` component.
- `MediaFormContext` via `createContext`.
- `MediaFormProvider` component:
  - Holds `hasSubmitted: boolean` in `useState` (initially `false`).
  - Exposes `markFormSubmitted()` callback that sets the flag to `true`.
- `useMediaFormContext()` hook:
  - Returns `{ hasSubmitted, markFormSubmitted }` when inside a provider.
  - Returns `null` when no provider wraps the tree (graceful fallback so
    `MediaForm` works standalone elsewhere).

## Files to modify

### 2. `apps/public_www/src/components/sections/media-form.tsx`

**Changes:**

- Import and call `useMediaFormContext()`.
- Read `hasSubmitted` from context (or `false` if context is `null`).
- **On successful submission** (`markSubmissionSuccess` call site inside
  `handleSubmit`): also call `markFormSubmitted()` from context.
- **Render logic change**: when `hasSubmitted` is `true` (set by another
  instance), return the success block (`formSuccessTitle` / `formSuccessBody`)
  immediately — same JSX as the existing `hasSuccessfulSubmission` branch.
  The priority order becomes:
  1. If local `hasSuccessfulSubmission` → show success (already submitted by
     this instance).
  2. Else if context `hasSubmitted` → show success (submitted by another
     instance).
  3. Else if `!isFormVisible` → show CTA button.
  4. Else → show form.
- **Fix duplicate HTML `id` bug**: replace hardcoded `id='media-first-name'`
  and `id='media-email'` with `useId()`-based unique IDs per instance, since
  two forms can coexist on the same page.
- **Fix duplicate error `id`**: make `MEDIA_FORM_ERROR_ID` unique per instance
  using the same `useId()` base.

### 3. `apps/public_www/src/components/pages/free-guides-and-resources.tsx`

**Changes:**

- Import `MediaFormProvider` from the new context module.
- Wrap the page children (or at minimum `FreeResourcesForGentleParenting` +
  `FreeGuidesAndResourcesLibrary`) with `<MediaFormProvider>`.
- `FreeGuidesAndResourcesPage` is currently a server component. Since
  `MediaFormProvider` is `'use client'`, it can be rendered as a child of the
  server component wrapping client children — valid Next.js App Router
  composition.

## Test files to update / create

### 4. `apps/public_www/tests/components/sections/media-form.test.tsx`

**Changes:**

- Add a helper that wraps renders in `<MediaFormProvider>` for tests that need
  shared context.
- **New test**: "skips form and shows success when context `hasSubmitted` is
  true" — render `MediaForm` inside a provider where another form already
  triggered `markFormSubmitted`. Verify the success title renders immediately
  without clicking the CTA.
- **New test**: "calls `markFormSubmitted` on successful submission" — render
  `MediaForm` inside a provider, submit successfully, verify `hasSubmitted`
  propagated (e.g. render a second `MediaForm` and check it shows success).
- Existing tests continue to work (no provider → `useMediaFormContext()`
  returns `null` → falls back to current behavior).

### 5. `apps/public_www/tests/components/sections/shared/media-form-context.test.tsx`

**New file:**

- Unit tests for `MediaFormProvider` and `useMediaFormContext`.
- Verify initial `hasSubmitted` is `false`.
- Verify `markFormSubmitted()` sets `hasSubmitted` to `true`.
- Verify the hook returns `null` when rendered outside a provider.

## UX behavior after change

1. User clicks CTA on form A → form opens → user fills name + email →
   submits → success state shown ("Check Your Email!"). Context
   `hasSubmitted` set to `true`.
2. Form B (elsewhere on the same page) immediately shows the success state
   ("Check Your Email!" / "Check your email for the download link!") — no CTA
   button, no form, no second captcha.
3. Page refresh resets everything (React state is ephemeral).

## Edge cases and risks

| Concern | Mitigation |
|---------|------------|
| **No provider fallback** | `useMediaFormContext()` returns `null` when no provider wraps the tree → `hasSubmitted` defaults to `false` → MediaForm works standalone unchanged. |
| **Captcha** | Not affected. Only the form that is actually submitted needs a captcha token. Skipped forms never submit. |
| **Duplicate HTML IDs** | Fixed by switching to `useId()`. Two expanded forms on the same page will no longer share `id='media-first-name'` / `id='media-email'`. |
| **PII persistence** | No storage APIs used. Data lives only in React state — cleared on navigation or refresh. |
| **Library items with `ctaHref` links** | Not affected. Only items rendered via `MediaForm` (currently `patience-free-guide`) participate in the context. Link-based items are unchanged. |
| **`FreeResourcesForGentleParenting` checklist hide** | The existing `hasOpenedMediaForm` logic in that section hides the checklist when the user opens the form. When the form is auto-skipped (success shown directly), the checklist should also hide. Will set `hasOpenedMediaForm` to `true` when context `hasSubmitted` is `true` via a `useEffect`. |

## Validation checklist

- [ ] Existing media-form tests pass.
- [ ] New context tests pass.
- [ ] New prefill/skip tests pass.
- [ ] `npm run lint` passes in `apps/public_www`.
- [ ] `bash scripts/validate-cursorrules.sh` passes.
- [ ] No hardcoded user-visible strings added (all copy from locale JSON).
- [ ] No `localStorage` / `sessionStorage` / PII persistence introduced.
