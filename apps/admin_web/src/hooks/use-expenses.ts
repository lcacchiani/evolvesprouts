'use client';

import { useCallback, useMemo, useState } from 'react';

import { createAdminAsset, deleteAdminAsset, uploadFileToPresignedUrl } from '@/lib/assets-api';
import {
  amendAdminExpense,
  cancelAdminExpense,
  createAdminExpense,
  listAdminExpenses,
  markAdminExpensePaid,
  reparseAdminExpense,
  updateAdminExpense,
} from '@/lib/expenses-api';
import type { Expense, ExpenseParseStatus, ExpenseStatus, UpsertExpenseInput } from '@/types/expenses';

import { toErrorMessage } from './hook-errors';
import { usePaginatedList } from './use-paginated-list';

const MAX_FILE_SIZE_BYTES = 15 * 1024 * 1024;
const ALLOWED_FILE_TYPES = new Set(['application/pdf', 'image/png', 'image/jpeg', 'image/webp']);

type Filters = {
  query: string;
  status: ExpenseStatus | '';
  parseStatus: ExpenseParseStatus | '';
};

const DEFAULT_FILTERS: Filters = {
  query: '',
  status: '',
  parseStatus: '',
};

export function useExpenses() {
  const [selectedExpenseId, setSelectedExpenseId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isUploadingFiles, setIsUploadingFiles] = useState(false);
  const [isDeletingId, setIsDeletingId] = useState<string | null>(null);
  const [isMarkingPaidId, setIsMarkingPaidId] = useState<string | null>(null);
  const [isReparsingId, setIsReparsingId] = useState<string | null>(null);
  const [mutationError, setMutationError] = useState('');

  const fetchExpenses = useCallback(
    async ({
      query,
      status,
      parseStatus,
      cursor,
      limit,
    }: Filters & { cursor: string | null; limit: number }) => {
      const response = await listAdminExpenses({
        query,
        status,
        parseStatus,
        cursor,
        limit,
      });
      return {
        items: response.items,
        nextCursor: response.nextCursor,
        totalCount: response.totalCount,
      };
    },
    []
  );

  const list = usePaginatedList<Expense, Filters>({
    defaultFilters: DEFAULT_FILTERS,
    debounceKeys: ['query'],
    debounceMs: 350,
    fetcher: fetchExpenses,
    errorPrefix: 'Failed to load expenses',
  });

  const selectedExpense = useMemo(
    () => list.items.find((item) => item.id === selectedExpenseId) ?? null,
    [list.items, selectedExpenseId]
  );

  const clearMutationError = useCallback(() => {
    setMutationError('');
  }, []);

  const selectExpense = useCallback((expenseId: string) => {
    setSelectedExpenseId(expenseId);
    setMutationError('');
  }, []);

  const clearSelectedExpense = useCallback(() => {
    setSelectedExpenseId(null);
    setMutationError('');
  }, []);

  const cleanupUploadedAssets = useCallback(async (assetIds: string[]): Promise<void> => {
    for (const assetId of assetIds) {
      try {
        await deleteAdminAsset(assetId);
      } catch {
        // Swallow cleanup errors so the original mutation error surfaces to the user.
      }
    }
  }, []);

  const uploadExpenseFiles = useCallback(async (files: File[]): Promise<string[]> => {
    if (files.length === 0) {
      return [];
    }
    setIsUploadingFiles(true);
    try {
      const assetIds: string[] = [];
      for (const file of files) {
        const normalizedType = file.type.trim().toLowerCase();
        if (!ALLOWED_FILE_TYPES.has(normalizedType)) {
          throw new Error(`Unsupported file type: ${file.type || 'unknown'}.`);
        }
        if (file.size > MAX_FILE_SIZE_BYTES) {
          throw new Error(`"${file.name}" exceeds 15MB size limit.`);
        }
        const createdAsset = await createAdminAsset({
          title: file.name,
          description: 'Expense attachment',
          assetType: 'document',
          fileName: file.name,
          contentType: file.type || 'application/octet-stream',
          visibility: 'restricted',
        });
        if (!createdAsset.asset?.id || !createdAsset.upload.uploadUrl) {
          throw new Error(`Could not prepare upload for "${file.name}".`);
        }
        await uploadFileToPresignedUrl({
          uploadUrl: createdAsset.upload.uploadUrl,
          uploadMethod: createdAsset.upload.uploadMethod,
          uploadHeaders: createdAsset.upload.uploadHeaders,
          file,
        });
        assetIds.push(createdAsset.asset.id);
      }
      return assetIds;
    } finally {
      setIsUploadingFiles(false);
    }
  }, []);

  const createExpenseEntry = useCallback(
    async ({
      input,
      files,
    }: {
      input: UpsertExpenseInput;
      files: File[];
    }) => {
      setIsSaving(true);
      setMutationError('');
      let uploadedAssetIds: string[] = [];
      try {
        uploadedAssetIds = await uploadExpenseFiles(files);
        const created = await createAdminExpense({
          ...input,
          attachmentAssetIds: uploadedAssetIds,
        });
        await list.refetch();
        setSelectedExpenseId(created?.id ?? null);
      } catch (error) {
        await cleanupUploadedAssets(uploadedAssetIds);
        setMutationError(toErrorMessage(error, 'Failed to create expense.'));
        throw error;
      } finally {
        setIsSaving(false);
      }
    },
    [cleanupUploadedAssets, list, uploadExpenseFiles]
  );

  const updateExpenseEntry = useCallback(
    async ({
      expenseId,
      input,
      newFiles,
      existingAttachmentAssetIds,
    }: {
      expenseId: string;
      input: UpsertExpenseInput;
      newFiles: File[];
      existingAttachmentAssetIds: string[];
    }) => {
      setIsSaving(true);
      setMutationError('');
      let uploadedAssetIds: string[] = [];
      try {
        uploadedAssetIds = await uploadExpenseFiles(newFiles);
        const updated = await updateAdminExpense(expenseId, {
          ...input,
          attachmentAssetIds: [...existingAttachmentAssetIds, ...uploadedAssetIds],
        });
        await list.refetch();
        setSelectedExpenseId(updated?.id ?? expenseId);
      } catch (error) {
        await cleanupUploadedAssets(uploadedAssetIds);
        setMutationError(toErrorMessage(error, 'Failed to update expense.'));
        throw error;
      } finally {
        setIsSaving(false);
      }
    },
    [cleanupUploadedAssets, list, uploadExpenseFiles]
  );

  const amendExpenseEntry = useCallback(
    async ({
      expenseId,
      input,
      newFiles,
      existingAttachmentAssetIds,
    }: {
      expenseId: string;
      input: UpsertExpenseInput;
      newFiles: File[];
      existingAttachmentAssetIds: string[];
    }) => {
      setIsSaving(true);
      setMutationError('');
      let uploadedAssetIds: string[] = [];
      try {
        uploadedAssetIds = await uploadExpenseFiles(newFiles);
        const amended = await amendAdminExpense(expenseId, {
          ...input,
          attachmentAssetIds: [...existingAttachmentAssetIds, ...uploadedAssetIds],
        });
        await list.refetch();
        setSelectedExpenseId(amended?.id ?? null);
      } catch (error) {
        await cleanupUploadedAssets(uploadedAssetIds);
        setMutationError(toErrorMessage(error, 'Failed to create amendment.'));
        throw error;
      } finally {
        setIsSaving(false);
      }
    },
    [cleanupUploadedAssets, list, uploadExpenseFiles]
  );

  const cancelExpenseEntry = useCallback(
    async (expenseId: string, reason: string) => {
      setIsDeletingId(expenseId);
      setMutationError('');
      try {
        await cancelAdminExpense(expenseId, reason);
        await list.refetch();
      } catch (error) {
        setMutationError(toErrorMessage(error, 'Failed to void expense.'));
        throw error;
      } finally {
        setIsDeletingId(null);
      }
    },
    [list]
  );

  const markPaidExpenseEntry = useCallback(
    async (expenseId: string) => {
      setIsMarkingPaidId(expenseId);
      setMutationError('');
      try {
        await markAdminExpensePaid(expenseId);
        await list.refetch();
      } catch (error) {
        setMutationError(toErrorMessage(error, 'Failed to mark expense as paid.'));
        throw error;
      } finally {
        setIsMarkingPaidId(null);
      }
    },
    [list]
  );

  const reparseExpenseEntry = useCallback(
    async (expenseId: string) => {
      setIsReparsingId(expenseId);
      setMutationError('');
      try {
        await reparseAdminExpense(expenseId);
        await list.refetch();
      } catch (error) {
        setMutationError(toErrorMessage(error, 'Failed to queue parse request.'));
        throw error;
      } finally {
        setIsReparsingId(null);
      }
    },
    [list]
  );

  return {
    ...list,
    selectedExpenseId,
    selectedExpense,
    isSaving,
    isUploadingFiles,
    isDeletingId,
    isMarkingPaidId,
    isReparsingId,
    mutationError,
    selectExpense,
    clearSelectedExpense,
    clearMutationError,
    createExpenseEntry,
    updateExpenseEntry,
    amendExpenseEntry,
    cancelExpenseEntry,
    markPaidExpenseEntry,
    reparseExpenseEntry,
  };
}
