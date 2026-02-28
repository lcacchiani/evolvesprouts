import { AdminApiError } from '@/lib/api-admin-client';

export function toAdminAssetErrorMessage(error: unknown, fallbackMessage: string): string {
  if (error instanceof AdminApiError) {
    if (error.statusCode === 404) {
      return 'Asset endpoints are not available in this deployment yet.';
    }
    if (error.statusCode === 403) {
      return 'You do not have permission to access assets.';
    }
    return error.message || fallbackMessage;
  }
  if (error instanceof Error) {
    return error.message;
  }
  return fallbackMessage;
}
