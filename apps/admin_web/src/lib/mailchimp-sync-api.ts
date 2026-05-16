import { adminApiRequest } from '@/lib/api-admin-client';
import type { components } from '@/types/generated/admin-api.generated';

type ApiSchemas = components['schemas'];

export type MailchimpSyncStatusResponse = ApiSchemas['MailchimpSyncStatusResponse'];
export type MailchimpSyncRunRequest = ApiSchemas['MailchimpSyncRunRequest'];
export type MailchimpSyncRunResponse = ApiSchemas['MailchimpSyncRunResponse'];
export type MailchimpSyncRunErrorSampleItem = ApiSchemas['MailchimpSyncRunErrorSampleItem'];
export type MailchimpOrphanCleanupRequest = ApiSchemas['MailchimpOrphanCleanupRequest'];
export type MailchimpOrphanCleanupResponse = ApiSchemas['MailchimpOrphanCleanupResponse'];
export type MailchimpOrphanRemovedSampleItem = ApiSchemas['MailchimpOrphanRemovedSampleItem'];

function stripEmptyCursor(req: MailchimpSyncRunRequest): MailchimpSyncRunRequest {
  const { cursor, ...rest } = req;
  if (cursor === null || cursor === undefined || cursor === '') {
    return rest;
  }
  return { ...rest, cursor };
}

export async function getMailchimpSyncStatus(
  signal?: AbortSignal
): Promise<MailchimpSyncStatusResponse> {
  return adminApiRequest<MailchimpSyncStatusResponse>({
    endpointPath: '/v1/admin/contacts/mailchimp-sync-status',
    method: 'GET',
    signal,
  });
}

export async function runMailchimpSyncBatch(
  req: MailchimpSyncRunRequest,
  signal?: AbortSignal
): Promise<MailchimpSyncRunResponse> {
  return adminApiRequest<MailchimpSyncRunResponse>({
    endpointPath: '/v1/admin/contacts/mailchimp-sync-run',
    method: 'POST',
    body: stripEmptyCursor(req),
    signal,
  });
}

export async function runMailchimpOrphanCleanup(
  req: MailchimpOrphanCleanupRequest,
  signal?: AbortSignal
): Promise<MailchimpOrphanCleanupResponse> {
  return adminApiRequest<MailchimpOrphanCleanupResponse>({
    endpointPath: '/v1/admin/contacts/mailchimp-sync-orphans',
    method: 'POST',
    body: req,
    signal,
  });
}
