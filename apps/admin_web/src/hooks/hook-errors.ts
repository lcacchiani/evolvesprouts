import { AdminApiError } from '@/lib/api-admin-client';

export type ToErrorMessageOptions = {
  /**
   * When true, prefer the backend `AdminApiError.message` (trimmed) for all status codes,
   * falling back to `fallback` only when the message is empty. Use for user actions where
   * 404/403 payloads (for example "Tag not found") are more helpful than generic deployment copy.
   */
  honorBackendMessage?: boolean;
};

/**
 * User-facing geocode errors: keep 404 copy specific to geocoding (not the generic
 * deployment message from {@link toErrorMessage}).
 */
export function formatGeocodeErrorMessage(error: unknown, fallbackNon404: string): string {
  if (error instanceof AdminApiError && error.statusCode === 404) {
    return 'Geocoding is not available in this environment yet.';
  }
  return toErrorMessage(error, fallbackNon404);
}

export function toErrorMessage(
  error: unknown,
  fallback: string,
  options?: ToErrorMessageOptions
): string {
  if (error instanceof AdminApiError) {
    if (options?.honorBackendMessage) {
      const trimmed = error.message?.trim();
      if (trimmed) {
        return trimmed;
      }
      return fallback;
    }
    if (error.statusCode === 404) {
      return 'The requested resource is not available in this deployment yet.';
    }
    if (error.statusCode === 403) {
      return 'You do not have permission to access this resource.';
    }
    return error.message || fallback;
  }
  return error instanceof Error && error.message ? error.message : fallback;
}
