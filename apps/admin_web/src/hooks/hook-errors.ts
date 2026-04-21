import { AdminApiError } from '@/lib/api-admin-client';

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

export function toErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof AdminApiError) {
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
