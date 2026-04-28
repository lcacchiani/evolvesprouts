/** Matches backend `MAX_LIST_LIMIT` in `app.api.admin_request.parse_limit`. */
export const ADMIN_API_MAX_LIST_LIMIT = 100;

/** Clamp page size so admin list requests never exceed the API cap. */
export function clampAdminListLimit(limit: number): number {
  const n = Math.floor(limit);
  if (!Number.isFinite(n) || n < 1) {
    return 1;
  }
  return Math.min(n, ADMIN_API_MAX_LIST_LIMIT);
}
