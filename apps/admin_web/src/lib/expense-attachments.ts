import type { ExpenseAttachment } from '@/types/expenses';

function attachmentSortKey(entry: ExpenseAttachment): number {
  if (typeof entry.sortOrder === 'number' && Number.isFinite(entry.sortOrder)) {
    return entry.sortOrder;
  }
  return 0;
}

/** First attachment by `sortOrder` (inbound email body + files share the same list). */
export function primaryExpenseAttachmentAssetId(attachments: ExpenseAttachment[]): string | null {
  if (!attachments.length) {
    return null;
  }
  const sorted = [...attachments].sort((a, b) => attachmentSortKey(a) - attachmentSortKey(b));
  const id = sorted[0]?.assetId?.trim();
  return id && id.length > 0 ? id : null;
}
