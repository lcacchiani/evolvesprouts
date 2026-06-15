import type { Dispatch, SetStateAction } from "react";

import type {
  BillingEnrollmentPickerRow,
  CustomerInvoiceSummary,
  CustomerPaymentDetail,
  CustomerPaymentSummary,
} from "@/lib/billing-api";

export interface ClientInvoicesPanelShared {
  draftFilterId: string;
  draftModeId: string;
  invoiceSearchFilterId: string;
  invoiceSettlementFilterId: string;
  draftInvoiceDateId: string;
  currencyOptions: ReturnType<
    typeof import("@/lib/format").getCurrencyOptions
  >;
  defaultCurrency: string;
  actionMessage: string;
  setActionMessage: Dispatch<SetStateAction<string>>;
  actionError: string;
  setActionError: Dispatch<SetStateAction<string>>;
  busyAction: string | null;
  setBusyAction: Dispatch<SetStateAction<string | null>>;
  exportBusy: boolean;
  setExportBusy: Dispatch<SetStateAction<boolean>>;
  setBusy: (key: string | null) => void;
}

export interface ClientInvoicesSelectionState {
  selectedInvoiceId: string | null;
  setSelectedInvoiceId: Dispatch<SetStateAction<string | null>>;
  allocateInvoiceId: string;
  setAllocateInvoiceId: Dispatch<SetStateAction<string>>;
  allocateLineId: string;
  setAllocateLineId: Dispatch<SetStateAction<string>>;
}

export interface ClientInvoicesPaymentsInput {
  shared: ClientInvoicesPanelShared;
  selection: ClientInvoicesSelectionState;
}

export interface ClientInvoicesInvoiceListInput {
  shared: ClientInvoicesPanelShared;
  selection: ClientInvoicesSelectionState;
  loadPayments: (signal?: AbortSignal) => Promise<void>;
  loadEnrollmentPicker: (
    signal?: AbortSignal,
    overrideServerQuery?: string,
  ) => Promise<void>;
  enrollmentFilter: string;
}

export interface ClientInvoicesDraftInput {
  shared: ClientInvoicesPanelShared;
  selection: ClientInvoicesSelectionState;
  loadPayments: (signal?: AbortSignal) => Promise<void>;
  loadInvoicesFirstPage: (signal?: AbortSignal) => Promise<void>;
}

export interface ClientInvoicesAllocateRefundInput {
  shared: ClientInvoicesPanelShared;
  selection: ClientInvoicesSelectionState;
  invoices: CustomerInvoiceSummary[];
  selectedId: string | null;
  detail: CustomerPaymentDetail | null;
  loadPayments: (signal?: AbortSignal) => Promise<void>;
  loadInvoicesFirstPage: (signal?: AbortSignal) => Promise<void>;
  loadDetail: (id: string, signal?: AbortSignal) => Promise<void>;
}

export type ClientInvoicesEnrollmentPickerRows = BillingEnrollmentPickerRow[];

export type ClientInvoicesPaymentSummaries = CustomerPaymentSummary[];
