import { AdminApiError } from '@/lib/api-admin-client';

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
