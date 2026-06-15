"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import type { ClientInvoicesSelectionState } from "@/hooks/client-invoices-panel-types";
import { useClientInvoicesAllocateRefund } from "@/hooks/use-client-invoices-allocate-refund";
import {
  buildClientInvoicesDraftVmSlice,
  useClientInvoicesDraft,
} from "@/hooks/use-client-invoices-draft";
import { useClientInvoicesInvoiceList } from "@/hooks/use-client-invoices-invoice-list";
import { useClientInvoicesPayments } from "@/hooks/use-client-invoices-payments";
import { useClientInvoicesPanelShared } from "@/hooks/use-client-invoices-panel-shared";

export function useClientInvoicesPanel() {
  const shared = useClientInvoicesPanelShared();

  const [selectedInvoiceId, setSelectedInvoiceId] = useState<string | null>(
    null,
  );
  const [allocateInvoiceId, setAllocateInvoiceId] = useState("");
  const [allocateLineId, setAllocateLineId] = useState("");

  const selection: ClientInvoicesSelectionState = {
    selectedInvoiceId,
    setSelectedInvoiceId,
    allocateInvoiceId,
    setAllocateInvoiceId,
    allocateLineId,
    setAllocateLineId,
  };

  const loadPaymentsRef = useRef<(signal?: AbortSignal) => Promise<void>>(
    async () => {},
  );
  const loadInvoicesFirstPageRef = useRef<(signal?: AbortSignal) => Promise<void>>(
    async () => {},
  );

  const loadPaymentsStable = useCallback(
    (signal?: AbortSignal) => loadPaymentsRef.current(signal),
    [],
  );
  const loadInvoicesFirstPageStable = useCallback(
    (signal?: AbortSignal) => loadInvoicesFirstPageRef.current(signal),
    [],
  );

  const draft = useClientInvoicesDraft({
    shared,
    selection,
    loadPayments: loadPaymentsStable,
    loadInvoicesFirstPage: loadInvoicesFirstPageStable,
  });

  const payments = useClientInvoicesPayments({
    shared,
    selection,
    enrollmentPickerRows: draft.enrollmentPickerRows,
  });

  const invoiceList = useClientInvoicesInvoiceList({
    shared,
    selection,
    loadPayments: payments.loadPayments,
    loadEnrollmentPicker: draft.loadEnrollmentPicker,
    enrollmentFilter: draft.enrollmentFilter,
  });

  useEffect(() => {
    loadPaymentsRef.current = payments.loadPayments;
    loadInvoicesFirstPageRef.current = invoiceList.loadInvoicesFirstPage;
  }, [payments.loadPayments, invoiceList.loadInvoicesFirstPage]);

  const allocateRefund = useClientInvoicesAllocateRefund({
    shared,
    selection,
    invoices: invoiceList.invoices,
    selectedId: payments.selectedId,
    detail: payments.detail,
    loadPayments: payments.loadPayments,
    loadInvoicesFirstPage: invoiceList.loadInvoicesFirstPage,
    loadDetail: payments.loadDetail,
  });

  const editorBusy = shared.busyAction !== null;

  return {
    ids: {
      draftFilterId: shared.draftFilterId,
      draftModeId: shared.draftModeId,
      invoiceSearchFilterId: shared.invoiceSearchFilterId,
      invoiceSettlementFilterId: shared.invoiceSettlementFilterId,
      draftInvoiceDateId: shared.draftInvoiceDateId,
    },
    currency: {
      currencyOptions: shared.currencyOptions,
      defaultCurrency: shared.defaultCurrency,
    },
    banners: {
      actionMessage: shared.actionMessage,
      actionError: shared.actionError,
    },
    busy: {
      busyAction: shared.busyAction,
      editorBusy,
      exportBusy: shared.exportBusy,
    },
    draft: buildClientInvoicesDraftVmSlice(
      shared,
      draft,
      payments.loadPayments,
      invoiceList.loadInvoicesFirstPage,
      selection,
    ),
    invoices: {
      invoices: invoiceList.invoices,
      invoiceListLoading: invoiceList.invoiceListLoading,
      invoiceListLoadingMore: invoiceList.invoiceListLoadingMore,
      invoiceListError: invoiceList.invoiceListError,
      invoiceListCursor: invoiceList.invoiceListCursor,
      invoiceStatusFilter: invoiceList.invoiceStatusFilter,
      setInvoiceStatusFilter: invoiceList.setInvoiceStatusFilter,
      invoiceSettlementFilter: invoiceList.invoiceSettlementFilter,
      setInvoiceSettlementFilter: invoiceList.setInvoiceSettlementFilter,
      invoiceCurrencyFilter: invoiceList.invoiceCurrencyFilter,
      setInvoiceCurrencyFilter: invoiceList.setInvoiceCurrencyFilter,
      invoiceSearchInput: invoiceList.invoiceSearchInput,
      setInvoiceSearchInput: invoiceList.setInvoiceSearchInput,
      selectedInvoiceId,
      setSelectedInvoiceId,
      selectedIssuedInvoice: invoiceList.selectedIssuedInvoice,
      issuedInvoiceEmailCsv: invoiceList.issuedInvoiceEmailCsv,
      setIssuedInvoiceEmailCsv: invoiceList.setIssuedInvoiceEmailCsv,
      issuedInvoiceEmailError: invoiceList.issuedInvoiceEmailError,
      setIssuedInvoiceEmailError: invoiceList.setIssuedInvoiceEmailError,
      issuedInvoiceEmailDirtyRef: invoiceList.issuedInvoiceEmailDirtyRef,
      handleEmailIssuedInvoice: invoiceList.handleEmailIssuedInvoice,
      loadMoreInvoices: invoiceList.loadMoreInvoices,
      handleOpenInvoicePdfPreview: invoiceList.handleOpenInvoicePdfPreview,
      handleIssueRow: invoiceList.handleIssueRow,
      openVoidInvoiceDialog: invoiceList.openVoidInvoiceDialog,
      openDeleteDraftInvoiceDialog: invoiceList.openDeleteDraftInvoiceDialog,
      deleteDraftDialogOpen: invoiceList.deleteDraftDialogOpen,
      voidDialogOpen: invoiceList.voidDialogOpen,
      setAllocateInvoiceId,
      setAllocateLineId,
    },
    manualPayment: {
      createPaymentEnrollmentId: payments.createPaymentEnrollmentId,
      setCreatePaymentEnrollmentId: payments.setCreatePaymentEnrollmentId,
      createPaymentEnrollmentPickerValue:
        payments.createPaymentEnrollmentPickerValue,
      createPaymentAmount: payments.createPaymentAmount,
      setCreatePaymentAmount: payments.setCreatePaymentAmount,
      createPaymentCurrency: payments.createPaymentCurrency,
      setCreatePaymentCurrency: payments.setCreatePaymentCurrency,
      createPaymentMethod: payments.createPaymentMethod,
      setCreatePaymentMethod: payments.setCreatePaymentMethod,
      createPaymentStatus: payments.createPaymentStatus,
      setCreatePaymentStatus: payments.setCreatePaymentStatus,
      createPaymentExternalRef: payments.createPaymentExternalRef,
      setCreatePaymentExternalRef: payments.setCreatePaymentExternalRef,
      manualPaymentIsUpdate: payments.manualPaymentIsUpdate,
      manualPaymentSucceededReadOnly: payments.manualPaymentSucceededReadOnly,
      manualPaymentEnrollmentEditLabel: payments.manualPaymentEnrollmentEditLabel,
      handleCancelManualPayment: payments.handleCancelManualPayment,
      handleManualPaymentFormSubmit: payments.handleManualPaymentFormSubmit,
      enrollmentPickerRows: draft.enrollmentPickerRows,
    },
    payments: {
      payments: payments.payments,
      listLoading: payments.listLoading,
      listError: payments.listError,
      selectedId: payments.selectedId,
      setSelectedId: payments.setSelectedId,
      setManualPaymentPreferCreateForm: payments.setManualPaymentPreferCreateForm,
      exportBusy: shared.exportBusy,
      handleExport: invoiceList.handleExport,
      openConfirmPaymentDialog: payments.openConfirmPaymentDialog,
      openDeletePaymentDialog: payments.openDeletePaymentDialog,
      confirmPaymentId: payments.confirmPaymentId,
      deletePaymentDialogOpen: payments.deletePaymentDialogOpen,
      confirmPaymentDialogOpen: payments.confirmPaymentDialogOpen,
    },
    allocate: {
      allocateInvoiceId,
      setAllocateInvoiceId,
      allocateLineId,
      setAllocateLineId,
      allocateAmount: allocateRefund.allocateAmount,
      setAllocateAmount: allocateRefund.setAllocateAmount,
      allocateCurrency: allocateRefund.allocateCurrency,
      setAllocateCurrency: allocateRefund.setAllocateCurrency,
      allocateInvoiceLines: allocateRefund.allocateInvoiceLines,
      allocateInvoiceLinesLoading: allocateRefund.allocateInvoiceLinesLoading,
      allocateInvoiceLinesError: allocateRefund.allocateInvoiceLinesError,
      allocateLinesOrdered: allocateRefund.allocateLinesOrdered,
      allocateLineDescriptionCounts: allocateRefund.allocateLineDescriptionCounts,
      issuedInvoicesForAllocate: invoiceList.issuedInvoicesForAllocate,
      handleAllocate: allocateRefund.handleAllocate,
      invoices: invoiceList.invoices,
    },
    refund: {
      refundInvoiceId: allocateRefund.refundInvoiceId,
      setRefundInvoiceId: allocateRefund.setRefundInvoiceId,
      refundPaymentSelectId: allocateRefund.refundPaymentSelectId,
      setRefundPaymentSelectId: allocateRefund.setRefundPaymentSelectId,
      refundPaymentsLoading: allocateRefund.refundPaymentsLoading,
      refundPaymentsError: allocateRefund.refundPaymentsError,
      refundEligiblePayments: allocateRefund.refundEligiblePayments,
      refundAmount: allocateRefund.refundAmount,
      setRefundAmount: allocateRefund.setRefundAmount,
      refundCurrency: allocateRefund.refundCurrency,
      setRefundCurrency: allocateRefund.setRefundCurrency,
      refundMethod: allocateRefund.refundMethod,
      setRefundMethod: allocateRefund.setRefundMethod,
      refundStripeId: allocateRefund.refundStripeId,
      setRefundStripeId: allocateRefund.setRefundStripeId,
      issuedInvoicesForAllocate: invoiceList.issuedInvoicesForAllocate,
      handleRefund: allocateRefund.handleRefund,
    },
    dialogs: {
      voidDialogOpen: invoiceList.voidDialogOpen,
      voidReason: invoiceList.voidReason,
      setVoidReason: invoiceList.setVoidReason,
      voidError: invoiceList.voidError,
      setVoidError: invoiceList.setVoidError,
      closeVoidInvoiceDialog: invoiceList.closeVoidInvoiceDialog,
      confirmVoidInvoice: invoiceList.confirmVoidInvoice,
      deleteDraftDialogOpen: invoiceList.deleteDraftDialogOpen,
      deleteDraftError: invoiceList.deleteDraftError,
      closeDeleteDraftInvoiceDialog: invoiceList.closeDeleteDraftInvoiceDialog,
      confirmDeleteDraftInvoice: invoiceList.confirmDeleteDraftInvoice,
      confirmPaymentDialogOpen: payments.confirmPaymentDialogOpen,
      confirmPaymentExternalRef: payments.confirmPaymentExternalRef,
      setConfirmPaymentExternalRef: payments.setConfirmPaymentExternalRef,
      confirmPaymentError: payments.confirmPaymentError,
      setConfirmPaymentError: payments.setConfirmPaymentError,
      closeConfirmPaymentDialog: payments.closeConfirmPaymentDialog,
      submitConfirmPayment: payments.submitConfirmPayment,
      deletePaymentDialogOpen: payments.deletePaymentDialogOpen,
      deletePaymentError: payments.deletePaymentError,
      closeDeletePaymentDialog: payments.closeDeletePaymentDialog,
      submitDeletePayment: payments.submitDeletePayment,
    },
  };
}
