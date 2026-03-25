import { AdminApiError, adminApiRequest } from './api-admin-client';
import { asNullableString, asTrimmedString, type ApiDataWrapper, unwrapPayload } from './api-payload';
import { isRecord } from './type-guards';

import type {
  Expense,
  ExpenseAttachment,
  ExpenseLineItem,
  ListAdminExpensesInput,
  PaginatedExpenseList,
  UpsertExpenseInput,
} from '@/types/expenses';
import type { components } from '@/types/generated/admin-api.generated';

type ApiSchemas = components['schemas'];
type ApiExpense = ApiSchemas['Expense'];
type ApiExpenseAttachment = ApiSchemas['ExpenseAttachment'];
type ApiExpenseLineItem = ApiSchemas['ExpenseLineItem'];
type ApiExpenseResponse = ApiSchemas['ExpenseResponse'];
type ApiExpenseListResponse = ApiSchemas['ExpenseListResponse'];
type ApiCreateExpenseRequest = ApiSchemas['CreateExpenseRequest'];
type ApiUpdateExpenseRequest = ApiSchemas['UpdateExpenseRequest'];
type ApiCancelExpenseRequest = ApiSchemas['CancelExpenseRequest'];

type ApiExpensePayload = ApiExpenseResponse | ApiExpense | ApiDataWrapper<ApiExpenseResponse | ApiExpense>;
type ApiExpenseListPayload = ApiExpenseListResponse | ApiDataWrapper<ApiExpenseListResponse>;

function isApiExpenseLineItem(value: unknown): value is ApiExpenseLineItem {
  return isRecord(value);
}

function isApiExpenseAttachment(value: unknown): value is ApiExpenseAttachment {
  return isRecord(value) && typeof value.id === 'string' && typeof value.asset_id === 'string';
}

function isApiExpense(value: unknown): value is ApiExpense {
  return isRecord(value) && typeof value.id === 'string';
}

function isApiExpenseResponse(value: unknown): value is ApiExpenseResponse {
  return isRecord(value) && isApiExpense(value.expense);
}

/** JSONB line items may store decimals as numbers; OpenAPI types them as strings. */
function lineItemDecimalFieldFromApi(value: unknown): string | null {
  if (value === null || value === undefined) {
    return null;
  }
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  }
  if (typeof value === 'number' && Number.isFinite(value)) {
    return String(value);
  }
  return null;
}

function parseLineItem(value: ApiExpenseLineItem): ExpenseLineItem {
  return {
    description: asNullableString(value.description ?? null),
    quantity: lineItemDecimalFieldFromApi(value.quantity),
    unitPrice: lineItemDecimalFieldFromApi(value.unit_price),
    amount: lineItemDecimalFieldFromApi(value.amount),
  };
}

function parseAttachment(value: ApiExpenseAttachment): ExpenseAttachment {
  return {
    id: asTrimmedString(value.id) ?? '',
    assetId: asTrimmedString(value.asset_id) ?? '',
    sortOrder: typeof value.sort_order === 'number' ? value.sort_order : 0,
    fileName: asNullableString(value.file_name ?? null),
    contentType: asNullableString(value.content_type ?? null),
    assetTitle: asNullableString(value.asset_title ?? null),
  };
}

function parseExpense(value: ApiExpense): Expense {
  const lineItems = Array.isArray(value.line_items)
    ? value.line_items.filter(isApiExpenseLineItem).map((entry) => parseLineItem(entry))
    : [];
  const attachments = Array.isArray(value.attachments)
    ? value.attachments.filter(isApiExpenseAttachment).map((entry) => parseAttachment(entry))
    : [];
  return {
    id: asTrimmedString(value.id) ?? '',
    amendsExpenseId: asNullableString(value.amends_expense_id ?? null),
    status: value.status,
    parseStatus: value.parse_status,
    vendorId: asNullableString(value.vendor_id ?? null),
    vendorName: asNullableString(value.vendor_name ?? null),
    invoiceNumber: asNullableString(value.invoice_number ?? null),
    invoiceDate: asNullableString(value.invoice_date ?? null),
    dueDate: asNullableString(value.due_date ?? null),
    currency: asNullableString(value.currency ?? null),
    subtotal: asNullableString(value.subtotal ?? null),
    tax: asNullableString(value.tax ?? null),
    total: asNullableString(value.total ?? null),
    lineItems,
    parseConfidence: asNullableString(value.parse_confidence ?? null),
    notes: asNullableString(value.notes ?? null),
    voidReason: asNullableString(value.void_reason ?? null),
    createdBy: asNullableString(value.created_by ?? null) ?? '',
    updatedBy: asNullableString(value.updated_by ?? null),
    createdAt: asNullableString(value.created_at ?? null) ?? '',
    updatedAt: asNullableString(value.updated_at ?? null) ?? '',
    submittedAt: asNullableString(value.submitted_at ?? null),
    paidAt: asNullableString(value.paid_at ?? null),
    voidedAt: asNullableString(value.voided_at ?? null),
    attachments,
  };
}

function normalizeExpenseInput(input: UpsertExpenseInput): ApiCreateExpenseRequest {
  return {
    status: input.status,
    vendor_id: input.vendorId?.trim() || null,
    invoice_number: input.invoiceNumber?.trim() || null,
    invoice_date: input.invoiceDate?.trim() || null,
    due_date: input.dueDate?.trim() || null,
    currency: input.currency?.trim() || null,
    subtotal: input.subtotal?.trim() || null,
    tax: input.tax?.trim() || null,
    total: input.total?.trim() || null,
    line_items:
      input.lineItems?.map((item) => ({
        description: item.description?.trim() || null,
        quantity: item.quantity?.trim() || null,
        unit_price: item.unitPrice?.trim() || null,
        amount: item.amount?.trim() || null,
      })) ?? [],
    notes: input.notes?.trim() || null,
    attachment_asset_ids: input.attachmentAssetIds ?? [],
    parse_requested: input.parseRequested,
  };
}

function normalizeExpenseUpdateInput(input: UpsertExpenseInput): ApiUpdateExpenseRequest {
  return normalizeExpenseInput(input);
}

function extractExpense(payload: ApiExpensePayload): Expense | null {
  const root = unwrapPayload(payload);
  if (isApiExpense(root)) {
    return parseExpense(root);
  }
  if (isApiExpenseResponse(root)) {
    return parseExpense(root.expense);
  }
  return null;
}

const EXPENSE_LIST_PAGE_LIMIT = 100;

export async function listAdminExpenses(
  input: ListAdminExpensesInput = {}
): Promise<PaginatedExpenseList> {
  const params = new URLSearchParams();
  if (input.query?.trim()) {
    params.set('query', input.query.trim());
  }
  if (input.status?.trim()) {
    params.set('status', input.status);
  }
  if (input.parseStatus?.trim()) {
    params.set('parse_status', input.parseStatus);
  }
  if (input.cursor?.trim()) {
    params.set('cursor', input.cursor);
  }
  if (typeof input.limit === 'number' && Number.isFinite(input.limit) && input.limit > 0) {
    params.set('limit', `${Math.min(Math.floor(input.limit), EXPENSE_LIST_PAGE_LIMIT)}`);
  }
  const queryString = params.toString();
  const endpointPath = queryString ? `/v1/admin/expenses?${queryString}` : '/v1/admin/expenses';
  const payload = await adminApiRequest<ApiExpenseListPayload>({
    endpointPath,
    method: 'GET',
  });
  const root = unwrapPayload(payload);
  return {
    items: Array.isArray(root.items)
      ? root.items.filter((entry): entry is ApiExpense => isApiExpense(entry)).map((entry) => parseExpense(entry))
      : [],
    nextCursor: asNullableString(root.next_cursor ?? null),
    totalCount: typeof root.total_count === 'number' ? root.total_count : 0,
  };
}

/** Fetches every expense page (for client-side aggregates such as vendor spend). */
export async function listAllAdminExpenses(): Promise<Expense[]> {
  const all: Expense[] = [];
  let cursor: string | null = null;
  do {
    const page = await listAdminExpenses({
      query: '',
      status: '',
      parseStatus: '',
      cursor,
      limit: EXPENSE_LIST_PAGE_LIMIT,
    });
    all.push(...page.items);
    cursor = page.nextCursor;
  } while (cursor);
  return all;
}

export async function getAdminExpense(expenseId: string): Promise<Expense | null> {
  const payload = await adminApiRequest<ApiExpensePayload>({
    endpointPath: `/v1/admin/expenses/${expenseId}`,
    method: 'GET',
  });
  return extractExpense(payload);
}

export async function createAdminExpense(input: UpsertExpenseInput): Promise<Expense | null> {
  const payload = await adminApiRequest<ApiExpensePayload>({
    endpointPath: '/v1/admin/expenses',
    method: 'POST',
    body: normalizeExpenseInput(input),
    expectedSuccessStatuses: [201],
  });
  return extractExpense(payload);
}

export async function updateAdminExpense(expenseId: string, input: UpsertExpenseInput): Promise<Expense | null> {
  const payload = await adminApiRequest<ApiExpensePayload>({
    endpointPath: `/v1/admin/expenses/${expenseId}`,
    method: 'PATCH',
    body: normalizeExpenseUpdateInput(input),
    expectedSuccessStatuses: [200],
  });
  return extractExpense(payload);
}

export async function amendAdminExpense(expenseId: string, input: UpsertExpenseInput): Promise<Expense | null> {
  const payload = await adminApiRequest<ApiExpensePayload>({
    endpointPath: `/v1/admin/expenses/${expenseId}/amend`,
    method: 'POST',
    body: normalizeExpenseUpdateInput(input),
    expectedSuccessStatuses: [201],
  });
  return extractExpense(payload);
}

export async function cancelAdminExpense(expenseId: string, reason: string): Promise<Expense | null> {
  const requestBody: ApiCancelExpenseRequest = {
    reason: reason.trim(),
  };
  const payload = await adminApiRequest<ApiExpensePayload>({
    endpointPath: `/v1/admin/expenses/${expenseId}/cancel`,
    method: 'POST',
    body: requestBody,
    expectedSuccessStatuses: [200],
  });
  return extractExpense(payload);
}

export async function markAdminExpensePaid(expenseId: string): Promise<Expense | null> {
  const payload = await adminApiRequest<ApiExpensePayload>({
    endpointPath: `/v1/admin/expenses/${expenseId}/mark-paid`,
    method: 'POST',
    expectedSuccessStatuses: [200],
  });
  return extractExpense(payload);
}

export async function reparseAdminExpense(expenseId: string): Promise<void> {
  await adminApiRequest({
    endpointPath: `/v1/admin/expenses/${expenseId}/reparse`,
    method: 'POST',
    expectedSuccessStatuses: [202],
  });
}

export async function safeGetAdminExpense(expenseId: string): Promise<Expense | null> {
  try {
    return await getAdminExpense(expenseId);
  } catch (error) {
    if (error instanceof AdminApiError && error.statusCode === 404) {
      return null;
    }
    throw error;
  }
}
