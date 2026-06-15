export interface BulkLeadFailure {
  leadId: string;
  reason: string;
}

export interface BulkLeadResult {
  succeeded: string[];
  failed: BulkLeadFailure[];
}

function failureReason(error: unknown): string {
  return error instanceof Error && error.message ? error.message : 'Update failed';
}

export async function runBulkLeadOps(
  leadIds: string[],
  operation: (leadId: string) => Promise<unknown>
): Promise<BulkLeadResult> {
  const results = await Promise.allSettled(leadIds.map((leadId) => operation(leadId)));
  const succeeded: string[] = [];
  const failed: BulkLeadFailure[] = [];

  results.forEach((result, index) => {
    const leadId = leadIds[index];
    if (result.status === 'fulfilled') {
      succeeded.push(leadId);
      return;
    }
    failed.push({ leadId, reason: failureReason(result.reason) });
  });

  return { succeeded, failed };
}

export function formatBulkLeadFailureSummary(failed: BulkLeadFailure[]): string {
  if (failed.length === 0) {
    return '';
  }
  const details = failed.map((entry) => `${entry.leadId}: ${entry.reason}`).join('; ');
  return `${failed.length} lead(s) failed — ${details}`;
}
