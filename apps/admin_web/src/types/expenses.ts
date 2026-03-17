import type { components } from '@/types/generated/admin-api.generated';

type ApiSchemas = components['schemas'];
type ApiExpense = ApiSchemas['Expense'];
type ApiExpenseAttachment = ApiSchemas['ExpenseAttachment'];
type ApiExpenseLineItem = ApiSchemas['ExpenseLineItem'];

type OptionalToNullable<T> = Exclude<T, undefined>;

function defineEnumValues<T extends string>() {
  return <U extends readonly T[]>(values: U & ([T] extends [U[number]] ? unknown : never)) => values;
}

export type ExpenseStatus = ApiSchemas['ExpenseStatus'];
export const EXPENSE_STATUSES = defineEnumValues<ExpenseStatus>()(
  ['draft', 'submitted', 'paid', 'voided', 'amended'] as const satisfies readonly ExpenseStatus[]
);

export type ExpenseParseStatus = ApiSchemas['ExpenseParseStatus'];
export const EXPENSE_PARSE_STATUSES = defineEnumValues<ExpenseParseStatus>()(
  ['not_requested', 'queued', 'processing', 'succeeded', 'failed'] as const satisfies readonly ExpenseParseStatus[]
);

export interface ExpenseLineItem {
  description: OptionalToNullable<ApiExpenseLineItem['description']>;
  quantity: OptionalToNullable<ApiExpenseLineItem['quantity']>;
  unitPrice: OptionalToNullable<ApiExpenseLineItem['unit_price']>;
  amount: OptionalToNullable<ApiExpenseLineItem['amount']>;
}

export interface ExpenseAttachment {
  id: ApiExpenseAttachment['id'];
  assetId: ApiExpenseAttachment['asset_id'];
  sortOrder: ApiExpenseAttachment['sort_order'];
  fileName: OptionalToNullable<ApiExpenseAttachment['file_name']>;
  contentType: OptionalToNullable<ApiExpenseAttachment['content_type']>;
  assetTitle: OptionalToNullable<ApiExpenseAttachment['asset_title']>;
}

export interface Expense {
  id: ApiExpense['id'];
  amendsExpenseId: OptionalToNullable<ApiExpense['amends_expense_id']>;
  status: ExpenseStatus;
  parseStatus: ExpenseParseStatus;
  vendorName: OptionalToNullable<ApiExpense['vendor_name']>;
  invoiceNumber: OptionalToNullable<ApiExpense['invoice_number']>;
  invoiceDate: OptionalToNullable<ApiExpense['invoice_date']>;
  dueDate: OptionalToNullable<ApiExpense['due_date']>;
  currency: OptionalToNullable<ApiExpense['currency']>;
  subtotal: OptionalToNullable<ApiExpense['subtotal']>;
  tax: OptionalToNullable<ApiExpense['tax']>;
  total: OptionalToNullable<ApiExpense['total']>;
  lineItems: ExpenseLineItem[];
  parseConfidence: OptionalToNullable<ApiExpense['parse_confidence']>;
  notes: OptionalToNullable<ApiExpense['notes']>;
  voidReason: OptionalToNullable<ApiExpense['void_reason']>;
  createdBy: OptionalToNullable<ApiExpense['created_by']>;
  updatedBy: OptionalToNullable<ApiExpense['updated_by']>;
  createdAt: OptionalToNullable<ApiExpense['created_at']>;
  updatedAt: OptionalToNullable<ApiExpense['updated_at']>;
  submittedAt: OptionalToNullable<ApiExpense['submitted_at']>;
  paidAt: OptionalToNullable<ApiExpense['paid_at']>;
  voidedAt: OptionalToNullable<ApiExpense['voided_at']>;
  attachments: ExpenseAttachment[];
}

export interface ListAdminExpensesInput {
  query?: string;
  status?: ExpenseStatus | '';
  parseStatus?: ExpenseParseStatus | '';
  cursor?: string | null;
  limit?: number;
}

export interface PaginatedExpenseList {
  items: Expense[];
  nextCursor: string | null;
  totalCount: number;
}

export interface UpsertExpenseInput {
  status?: ExpenseStatus;
  vendorName?: string | null;
  invoiceNumber?: string | null;
  invoiceDate?: string | null;
  dueDate?: string | null;
  currency?: string | null;
  subtotal?: string | null;
  tax?: string | null;
  total?: string | null;
  lineItems?: ExpenseLineItem[];
  notes?: string | null;
  attachmentAssetIds?: string[];
  parseRequested?: boolean;
}
