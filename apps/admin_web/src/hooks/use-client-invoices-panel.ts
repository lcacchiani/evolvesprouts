"use client";

import type { FormEvent } from "react";
import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";

import { toErrorMessage } from "@/hooks/hook-errors";
import {
  confirmCustomerPayment,
  createCustomerRefund,
  createManualInboundCustomerPayment,
  createDraftInvoice,
  createPaymentAllocation,
  deleteCustomerPayment,
  deleteDraftCustomerInvoice,
  emailInvoice,
  exportBillingCsv,
  getCustomerInvoice,
  getCustomerInvoicePdfDownload,
  getCustomerPayment,
  issueInvoice,
  listCustomerInvoices,
  listCustomerPayments,
  listRecentEnrollmentsForInvoicing,
  compareBillingEnrollmentPickerRowsByEnrolledAtDesc,
  updateManualInboundCustomerPayment,
  voidInvoice,
  type BillingEnrollmentPickerRow,
  type CustomerInvoiceSummary,
  type CustomerPaymentDetail,
  type CustomerPaymentSummary,
} from "@/lib/billing-api";
import { getAdminDefaultCurrencyCode } from "@/lib/config";
import { getCurrencyOptions, localTodayYmd } from "@/lib/format";
import {
  currencySelectValue,
  defaultLineAmount,
  formatAmountSeedTwoDecimals,
  formatManualPaymentEnrollmentEditLabel,
  INVOICE_LIST_SEARCH_DEBOUNCE_MS,
  invoiceLineSortKey,
  isManualInboundPaymentEditable,
  lineAmountsDiffer,
  NO_ENROLLMENT_OPTION_VALUE,
  normalizeInvoiceRecipientList,
  parseAmountInput,
  type CustomerInvoiceLineRow,
} from "@/components/admin/finance/client-invoices-utils";

export function useClientInvoicesPanel() {
  const draftFilterId = useId();
  const draftModeId = useId();
  const invoiceSearchFilterId = useId();
  const invoiceSettlementFilterId = useId();
  const currencyOptions = useMemo(() => getCurrencyOptions(), []);
  const defaultCurrency = useMemo(() => getAdminDefaultCurrencyCode(), []);

  const [draftCreationMode, setDraftCreationMode] = useState<
    "enrollment" | "customized"
  >("enrollment");
  const [customizedFormSubmitEnabled, setCustomizedFormSubmitEnabled] =
    useState(false);

  const [payments, setPayments] = useState<CustomerPaymentSummary[]>([]);
  const [listLoading, setListLoading] = useState(true);
  const [listError, setListError] = useState("");
  const [invoices, setInvoices] = useState<CustomerInvoiceSummary[]>([]);
  const [invoiceListLoading, setInvoiceListLoading] = useState(true);
  const [invoiceListLoadingMore, setInvoiceListLoadingMore] = useState(false);
  const [invoiceListError, setInvoiceListError] = useState("");
  const [invoiceListCursor, setInvoiceListCursor] = useState<string | null>(
    null,
  );
  const [invoiceStatusFilter, setInvoiceStatusFilter] = useState<
    "draft" | "issued" | "void" | ""
  >("");
  const [invoiceSettlementFilter, setInvoiceSettlementFilter] = useState<
    "not_completed" | "open" | "partially_paid" | "paid" | "no_charge" | ""
  >("not_completed");
  const [invoiceCurrencyFilter, setInvoiceCurrencyFilter] = useState("");
  const [invoiceSearchInput, setInvoiceSearchInput] = useState("");
  const [invoiceSearchDebounced, setInvoiceSearchDebounced] = useState("");
  const [selectedInvoiceId, setSelectedInvoiceId] = useState<string | null>(
    null,
  );
  const [issuedInvoiceEmailCsv, setIssuedInvoiceEmailCsv] = useState("");
  const [issuedInvoiceEmailError, setIssuedInvoiceEmailError] = useState("");
  const [actionMessage, setActionMessage] = useState("");
  const [actionError, setActionError] = useState("");
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [exportBusy, setExportBusy] = useState(false);

  const [voidDialogOpen, setVoidDialogOpen] = useState(false);
  const [voidInvoiceTargetId, setVoidInvoiceTargetId] = useState<string | null>(
    null,
  );
  const [voidReason, setVoidReason] = useState("");
  const [voidError, setVoidError] = useState("");

  const [deleteDraftDialogOpen, setDeleteDraftDialogOpen] = useState(false);
  const [deleteDraftInvoiceId, setDeleteDraftInvoiceId] = useState<
    string | null
  >(null);
  const [deleteDraftError, setDeleteDraftError] = useState("");

  const [confirmPaymentDialogOpen, setConfirmPaymentDialogOpen] =
    useState(false);
  const [confirmPaymentId, setConfirmPaymentId] = useState<string | null>(null);
  const [confirmPaymentExternalRef, setConfirmPaymentExternalRef] =
    useState("");
  const [confirmPaymentError, setConfirmPaymentError] = useState("");

  const [deletePaymentDialogOpen, setDeletePaymentDialogOpen] = useState(false);
  const [deletePaymentId, setDeletePaymentId] = useState<string | null>(null);
  const [deletePaymentError, setDeletePaymentError] = useState("");

  const [enrollmentPickerRows, setEnrollmentPickerRows] = useState<
    BillingEnrollmentPickerRow[]
  >([]);
  const [enrollmentPickerTruncated, setEnrollmentPickerTruncated] =
    useState(false);
  const [enrollmentPickerLoading, setEnrollmentPickerLoading] = useState(true);
  const [enrollmentPickerError, setEnrollmentPickerError] = useState("");
  const [enrollmentFilter, setEnrollmentFilter] = useState("");
  const [selectedEnrollmentIds, setSelectedEnrollmentIds] = useState<
    Set<string>
  >(() => new Set());
  const [lineOverrideByEnrollmentId, setLineOverrideByEnrollmentId] = useState<
    Record<string, string>
  >({});
  const draftInvoiceDateMin = "2000-01-01";
  const draftInvoiceDateMax = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() + 365);
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  }, []);
  const draftInvoiceDateId = useId();
  const [draftInvoiceDate, setDraftInvoiceDate] = useState<string>(() =>
    localTodayYmd(),
  );

  const [allocateInvoiceId, setAllocateInvoiceId] = useState("");
  const [allocateLineId, setAllocateLineId] = useState("");
  const [allocateAmount, setAllocateAmount] = useState("");
  const [allocateCurrency, setAllocateCurrency] = useState(defaultCurrency);
  const [allocateInvoiceLines, setAllocateInvoiceLines] = useState<
    CustomerInvoiceLineRow[]
  >([]);
  const [allocateInvoiceLinesLoading, setAllocateInvoiceLinesLoading] =
    useState(false);
  const [allocateInvoiceLinesError, setAllocateInvoiceLinesError] =
    useState("");

  const [refundInvoiceId, setRefundInvoiceId] = useState("");
  const [refundPaymentSelectId, setRefundPaymentSelectId] = useState("");
  const [refundPaymentsForInvoice, setRefundPaymentsForInvoice] = useState<
    CustomerPaymentSummary[]
  >([]);
  const [refundPaymentsLoading, setRefundPaymentsLoading] = useState(false);
  const [refundPaymentsError, setRefundPaymentsError] = useState("");
  const [refundInvoicePaymentsRefresh, setRefundInvoicePaymentsRefresh] =
    useState(0);
  const [refundAmount, setRefundAmount] = useState("");
  const [refundCurrency, setRefundCurrency] = useState(defaultCurrency);
  const [refundMethod, setRefundMethod] = useState("");
  const [refundStripeId, setRefundStripeId] = useState("");

  const [createPaymentEnrollmentId, setCreatePaymentEnrollmentId] =
    useState("");
  const [createPaymentAmount, setCreatePaymentAmount] = useState("");
  const [createPaymentCurrency, setCreatePaymentCurrency] =
    useState(defaultCurrency);
  const [createPaymentMethod, setCreatePaymentMethod] =
    useState("bank_transfer");
  const [createPaymentStatus, setCreatePaymentStatus] = useState<
    "pending" | "succeeded"
  >("pending");
  const [createPaymentExternalRef, setCreatePaymentExternalRef] = useState("");

  const resetManualPaymentCreateFields = useCallback(() => {
    setCreatePaymentEnrollmentId("");
    setCreatePaymentAmount("");
    setCreatePaymentCurrency(defaultCurrency);
    setCreatePaymentMethod("bank_transfer");
    setCreatePaymentStatus("pending");
    setCreatePaymentExternalRef("");
  }, [defaultCurrency]);

  const createPaymentEnrollmentPickerValue = useMemo(() => {
    const tid = createPaymentEnrollmentId.trim();
    if (tid === "") {
      return "";
    }
    if (tid === NO_ENROLLMENT_OPTION_VALUE) {
      return NO_ENROLLMENT_OPTION_VALUE;
    }
    return enrollmentPickerRows.some((r) => r.enrollmentId === tid) ? tid : "";
  }, [createPaymentEnrollmentId, enrollmentPickerRows]);

  const lastPaymentSeedIdRef = useRef<string | null>(null);
  const prevIssuedInvoiceSelectionRef = useRef<string | null>(null);
  const issuedInvoiceEmailDirtyRef = useRef(false);

  useEffect(() => {
    const id = window.setTimeout(() => {
      setInvoiceSearchDebounced(invoiceSearchInput.trim());
    }, INVOICE_LIST_SEARCH_DEBOUNCE_MS);
    return () => window.clearTimeout(id);
  }, [invoiceSearchInput]);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [manualPaymentPreferCreateForm, setManualPaymentPreferCreateForm] =
    useState(false);
  const [detail, setDetail] = useState<CustomerPaymentDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState("");

  const loadPayments = useCallback(async (signal?: AbortSignal) => {
    setListLoading(true);
    setListError("");
    try {
      const items = await listCustomerPayments({}, signal);
      setPayments(items);
    } catch (caught) {
      if (caught instanceof Error && caught.name === "AbortError") {
        return;
      }
      const message = toErrorMessage(caught, "Failed to load payments.", {
        honorBackendMessage: true,
      });
      setListError(message);
    } finally {
      setListLoading(false);
    }
  }, []);

  useEffect(() => {
    const ac = new AbortController();
    void loadPayments(ac.signal);
    return () => ac.abort();
  }, [loadPayments]);

  const [debouncedEnrollmentFilter, setDebouncedEnrollmentFilter] =
    useState("");

  useEffect(() => {
    const t = window.setTimeout(
      () => setDebouncedEnrollmentFilter(enrollmentFilter.trim()),
      350,
    );
    return () => window.clearTimeout(t);
  }, [enrollmentFilter]);

  const loadEnrollmentPicker = useCallback(
    async (signal?: AbortSignal, overrideServerQuery?: string) => {
      setEnrollmentPickerLoading(true);
      setEnrollmentPickerError("");
      const serverQuery =
        overrideServerQuery !== undefined
          ? overrideServerQuery
          : debouncedEnrollmentFilter;
      try {
        const { items, truncated } = await listRecentEnrollmentsForInvoicing(
          signal,
          serverQuery === "" ? undefined : { q: serverQuery },
        );
        setEnrollmentPickerRows(items);
        setEnrollmentPickerTruncated(truncated);
        setSelectedEnrollmentIds((prev) => {
          const allowed = new Set(
            items.filter((r) => !r.invoiceLinked).map((r) => r.enrollmentId),
          );
          const next = new Set<string>();
          for (const id of prev) {
            if (allowed.has(id)) {
              next.add(id);
            }
          }
          return next;
        });
      } catch (caught) {
        if (caught instanceof Error && caught.name === "AbortError") {
          return;
        }
        const message = toErrorMessage(
          caught,
          "Failed to load enrollments for invoicing.",
          { honorBackendMessage: true },
        );
        setEnrollmentPickerError(message);
        setEnrollmentPickerRows([]);
        setEnrollmentPickerTruncated(false);
      } finally {
        setEnrollmentPickerLoading(false);
      }
    },
    [debouncedEnrollmentFilter],
  );

  useEffect(() => {
    const ac = new AbortController();
    void loadEnrollmentPicker(ac.signal);
    return () => ac.abort();
  }, [loadEnrollmentPicker]);

  const selectableFilteredRows = useMemo(
    () => enrollmentPickerRows.filter((row) => !row.invoiceLinked),
    [enrollmentPickerRows],
  );

  const selectedEnrollmentRows = useMemo(() => {
    const map = new Map(enrollmentPickerRows.map((r) => [r.enrollmentId, r]));
    const out: BillingEnrollmentPickerRow[] = [];
    for (const id of selectedEnrollmentIds) {
      const row = map.get(id);
      if (row) {
        out.push(row);
      }
    }
    out.sort(compareBillingEnrollmentPickerRowsByEnrolledAtDesc);
    return out;
  }, [enrollmentPickerRows, selectedEnrollmentIds]);

  const draftSelectionIssue = useMemo(() => {
    if (selectedEnrollmentRows.length === 0) {
      return "";
    }
    const currencies = new Set(selectedEnrollmentRows.map((r) => r.currency));
    if (currencies.size > 1) {
      return "Selected enrollments must share one currency.";
    }
    const billKeys = new Set(
      selectedEnrollmentRows.map((r) => r.billToMergeKey),
    );
    if (billKeys.size > 1) {
      return "Selected enrollments must share the same bill-to (contact/family/organization).";
    }
    return "";
  }, [selectedEnrollmentRows]);

  const draftAmountIssue = useMemo(() => {
    for (const row of selectedEnrollmentRows) {
      const raw =
        lineOverrideByEnrollmentId[row.enrollmentId] ?? defaultLineAmount(row);
      const amt = parseAmountInput(raw);
      if (amt === null) {
        return "Enter a valid number for every line total (0 is allowed).";
      }
    }
    return "";
  }, [selectedEnrollmentRows, lineOverrideByEnrollmentId]);

  const loadInvoicesFirstPage = useCallback(
    async (signal?: AbortSignal) => {
      setInvoiceListLoading(true);
      setInvoiceListError("");
      setInvoiceListCursor(null);
      try {
        const { items, next_cursor } = await listCustomerInvoices(
          {
            status:
              invoiceStatusFilter === "" ? undefined : invoiceStatusFilter,
            settlement:
              invoiceSettlementFilter === ""
                ? undefined
                : invoiceSettlementFilter,
            currency:
              invoiceCurrencyFilter === "" ? undefined : invoiceCurrencyFilter,
            q:
              invoiceSearchDebounced === ""
                ? undefined
                : invoiceSearchDebounced,
            limit: 50,
          },
          signal,
        );
        setInvoices(items);
        setInvoiceListCursor(next_cursor);
      } catch (caught) {
        if (caught instanceof Error && caught.name === "AbortError") {
          return;
        }
        const message = toErrorMessage(caught, "Failed to load invoices.", {
          honorBackendMessage: true,
        });
        setInvoiceListError(message);
        setInvoices([]);
      } finally {
        setInvoiceListLoading(false);
      }
    },
    [
      invoiceCurrencyFilter,
      invoiceSearchDebounced,
      invoiceStatusFilter,
      invoiceSettlementFilter,
    ],
  );

  useEffect(() => {
    const ac = new AbortController();
    void loadInvoicesFirstPage(ac.signal);
    return () => ac.abort();
  }, [loadInvoicesFirstPage]);

  const loadMoreInvoices = useCallback(async () => {
    if (!invoiceListCursor) {
      return;
    }
    setInvoiceListLoadingMore(true);
    setInvoiceListError("");
    try {
      const { items, next_cursor } = await listCustomerInvoices({
        status: invoiceStatusFilter === "" ? undefined : invoiceStatusFilter,
        settlement:
          invoiceSettlementFilter === "" ? undefined : invoiceSettlementFilter,
        currency:
          invoiceCurrencyFilter === "" ? undefined : invoiceCurrencyFilter,
        q: invoiceSearchDebounced === "" ? undefined : invoiceSearchDebounced,
        cursor: invoiceListCursor,
        limit: 50,
      });
      setInvoices((prev) => [...prev, ...items]);
      setInvoiceListCursor(next_cursor);
    } catch (caught) {
      const message = toErrorMessage(caught, "Failed to load more invoices.", {
        honorBackendMessage: true,
      });
      setInvoiceListError(message);
    } finally {
      setInvoiceListLoadingMore(false);
    }
  }, [
    invoiceListCursor,
    invoiceCurrencyFilter,
    invoiceSearchDebounced,
    invoiceStatusFilter,
    invoiceSettlementFilter,
  ]);

  const selectedIssuedInvoice = useMemo(() => {
    if (!selectedInvoiceId) {
      return null;
    }
    return invoices.find((inv) => inv.id === selectedInvoiceId) ?? null;
  }, [invoices, selectedInvoiceId]);

  const issuedInvoicesForAllocate = useMemo(
    () =>
      invoices.filter(
        (inv) => inv.status === "issued" && (inv.id?.trim() ?? "") !== "",
      ),
    [invoices],
  );

  const refundEligiblePayments = useMemo(
    () =>
      refundPaymentsForInvoice.filter(
        (p) => p.direction === "inbound" && p.status === "succeeded",
      ),
    [refundPaymentsForInvoice],
  );

  useEffect(() => {
    if (!selectedInvoiceId) {
      return;
    }
    const inv = invoices.find((i) => i.id === selectedInvoiceId);
    if (inv?.status === "issued") {
      setRefundInvoiceId(selectedInvoiceId);
    }
  }, [selectedInvoiceId, invoices]);

  const allocateLinesOrdered = useMemo(
    () =>
      [...allocateInvoiceLines].sort(
        (a, b) => invoiceLineSortKey(a) - invoiceLineSortKey(b),
      ),
    [allocateInvoiceLines],
  );

  const allocateLineDescriptionCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const line of allocateLinesOrdered) {
      const d = line.description?.trim() ?? "";
      if (d !== "") {
        counts.set(d, (counts.get(d) ?? 0) + 1);
      }
    }
    return counts;
  }, [allocateLinesOrdered]);

  useEffect(() => {
    const trimmed = allocateInvoiceId.trim();
    if (trimmed === "") {
      setAllocateInvoiceLines([]);
      setAllocateInvoiceLinesError("");
      setAllocateInvoiceLinesLoading(false);
      setAllocateLineId("");
      return;
    }
    const invRow = invoices.find((i) => i.id === trimmed);
    if (invRow?.status !== "issued") {
      setAllocateInvoiceLines([]);
      setAllocateInvoiceLinesError("");
      setAllocateInvoiceLinesLoading(false);
      setAllocateLineId("");
      return;
    }
    const ac = new AbortController();
    setAllocateInvoiceLinesLoading(true);
    setAllocateInvoiceLinesError("");
    void (async () => {
      try {
        const detail = await getCustomerInvoice(trimmed, ac.signal);
        if (ac.signal.aborted) {
          return;
        }
        const lines = Array.isArray(detail.lines) ? detail.lines : [];
        setAllocateInvoiceLines(lines);
        setAllocateLineId((prev) => {
          const ok = lines.some((l) => l.id === prev);
          return ok ? prev : "";
        });
      } catch (caught) {
        if (caught instanceof Error && caught.name === "AbortError") {
          return;
        }
        if (!ac.signal.aborted) {
          setAllocateInvoiceLines([]);
          setAllocateLineId("");
          setAllocateInvoiceLinesError(
            toErrorMessage(caught, "Failed to load invoice lines.", {
              honorBackendMessage: true,
            }),
          );
        }
      } finally {
        if (!ac.signal.aborted) {
          setAllocateInvoiceLinesLoading(false);
        }
      }
    })();
    return () => ac.abort();
  }, [allocateInvoiceId, invoices]);

  useEffect(() => {
    setIssuedInvoiceEmailError("");
    const inv = selectedIssuedInvoice;

    if (!inv || inv.status !== "issued") {
      prevIssuedInvoiceSelectionRef.current = null;
      issuedInvoiceEmailDirtyRef.current = false;
      setIssuedInvoiceEmailCsv("");
      return;
    }

    const id = inv.id ?? "";
    const bill = inv.billToEmail?.trim() ?? "";

    if (prevIssuedInvoiceSelectionRef.current !== id) {
      prevIssuedInvoiceSelectionRef.current = id;
      issuedInvoiceEmailDirtyRef.current = false;
      setIssuedInvoiceEmailCsv(bill);
      return;
    }

    if (!issuedInvoiceEmailDirtyRef.current) {
      setIssuedInvoiceEmailCsv(bill);
    }
  }, [selectedIssuedInvoice]);

  const loadDetail = useCallback(
    async (id: string, signal?: AbortSignal) => {
      setDetailLoading(true);
      setDetailError("");
      try {
        const row = await getCustomerPayment(id, signal);
        if (signal?.aborted) {
          return;
        }
        setDetail(row);
        if (lastPaymentSeedIdRef.current !== id) {
          lastPaymentSeedIdRef.current = id;
          const cur = row.currency ?? defaultCurrency;
          setAllocateCurrency(
            currencySelectValue(cur, currencyOptions, defaultCurrency),
          );
          setRefundPaymentSelectId(row.id ?? "");
          setRefundCurrency(
            currencySelectValue(cur, currencyOptions, defaultCurrency),
          );
        }
      } catch (caught) {
        if (caught instanceof Error && caught.name === "AbortError") {
          return;
        }
        const message = toErrorMessage(caught, "Failed to load payment.", {
          honorBackendMessage: true,
        });
        setDetailError(message);
        setDetail(null);
      } finally {
        if (!signal?.aborted) {
          setDetailLoading(false);
        }
      }
    },
    [currencyOptions, defaultCurrency],
  );

  useEffect(() => {
    setActionMessage("");
    setActionError("");
  }, [selectedId, selectedInvoiceId]);

  useEffect(() => {
    if (!selectedId) {
      setDetail(null);
      setDetailError("");
      lastPaymentSeedIdRef.current = null;
      return;
    }
    const ac = new AbortController();
    void loadDetail(selectedId, ac.signal);
    return () => ac.abort();
  }, [selectedId, loadDetail]);

  useEffect(() => {
    setManualPaymentPreferCreateForm(false);
  }, [selectedId]);

  useEffect(() => {
    if (!selectedId) {
      resetManualPaymentCreateFields();
      return;
    }
    if (manualPaymentPreferCreateForm) {
      return;
    }
    const row = payments.find((p) => p.id === selectedId) ?? null;
    if (row === null || !isManualInboundPaymentEditable(row)) {
      resetManualPaymentCreateFields();
      return;
    }
    const curRow = row;
    const seedFromList = () => {
      setCreatePaymentEnrollmentId(curRow.enrollmentId?.trim() ?? "");
      setCreatePaymentAmount(
        formatAmountSeedTwoDecimals(curRow.amount?.trim() ?? ""),
      );
      const cur =
        (curRow.currency ?? defaultCurrency).trim().toUpperCase() ||
        defaultCurrency;
      setCreatePaymentCurrency(
        currencySelectValue(cur, currencyOptions, defaultCurrency),
      );
      setCreatePaymentMethod(curRow.method?.trim() || "bank_transfer");
      setCreatePaymentStatus(
        curRow.status === "succeeded" ? "succeeded" : "pending",
      );
      setCreatePaymentExternalRef(curRow.externalReference?.trim() ?? "");
    };
    if (!detail || detail.id !== selectedId) {
      seedFromList();
      return;
    }
    setCreatePaymentEnrollmentId(detail.enrollmentId?.trim() ?? "");
    setCreatePaymentAmount(formatAmountSeedTwoDecimals(detail.amount?.trim() ?? ""));
    const cur =
      (detail.currency ?? defaultCurrency).trim().toUpperCase() ||
      defaultCurrency;
    setCreatePaymentCurrency(
      currencySelectValue(cur, currencyOptions, defaultCurrency),
    );
    setCreatePaymentMethod(detail.method?.trim() || "bank_transfer");
    setCreatePaymentStatus(
      detail.status === "succeeded" ? "succeeded" : "pending",
    );
    setCreatePaymentExternalRef(detail.externalReference?.trim() ?? "");
  }, [
    selectedId,
    detail,
    payments,
    defaultCurrency,
    currencyOptions,
    resetManualPaymentCreateFields,
    manualPaymentPreferCreateForm,
  ]);

  useEffect(() => {
    if (!selectedId || !detail) {
      return;
    }
    const refs = detail.allocationInvoices ?? [];
    if (refs.length === 0) {
      return;
    }
    const ids = new Set(refs.map((r) => r.invoiceId));
    setRefundInvoiceId((prev) => {
      if (prev && ids.has(prev)) {
        return prev;
      }
      const preferred = allocateInvoiceId.trim();
      if (preferred && ids.has(preferred)) {
        return preferred;
      }
      return refs[0]?.invoiceId ?? "";
    });
  }, [selectedId, detail, allocateInvoiceId]);

  useEffect(() => {
    const trimmed = refundInvoiceId.trim();
    if (trimmed === "") {
      setRefundPaymentsForInvoice([]);
      setRefundPaymentsLoading(false);
      setRefundPaymentsError("");
      return;
    }
    const ac = new AbortController();
    setRefundPaymentsLoading(true);
    setRefundPaymentsError("");
    void (async () => {
      try {
        const items = await listCustomerPayments(
          { invoiceId: trimmed },
          ac.signal,
        );
        if (ac.signal.aborted) {
          return;
        }
        setRefundPaymentsForInvoice(items);
        setRefundPaymentSelectId((prev) => {
          const inboundMatch = items.find(
            (p) =>
              p.id === prev &&
              p.direction === "inbound" &&
              p.status === "succeeded",
          );
          if (inboundMatch) {
            return prev;
          }
          const selectedMatch =
            selectedId &&
            items.find(
              (p) =>
                p.id === selectedId &&
                p.direction === "inbound" &&
                p.status === "succeeded",
            );
          if (selectedMatch) {
            return selectedId;
          }
          return (
            items.find(
              (p) => p.direction === "inbound" && p.status === "succeeded",
            )?.id ?? ""
          );
        });
      } catch (caught) {
        if (caught instanceof Error && caught.name === "AbortError") {
          return;
        }
        if (!ac.signal.aborted) {
          setRefundPaymentsForInvoice([]);
          setRefundPaymentSelectId("");
          setRefundPaymentsError(
            toErrorMessage(caught, "Failed to load payments for invoice.", {
              honorBackendMessage: true,
            }),
          );
        }
      } finally {
        if (!ac.signal.aborted) {
          setRefundPaymentsLoading(false);
        }
      }
    })();
    return () => ac.abort();
  }, [refundInvoiceId, selectedId, refundInvoicePaymentsRefresh]);

  const setBusy = (key: string | null) => {
    setBusyAction(key);
  };

  const openVoidInvoiceDialog = (invoiceId: string) => {
    setVoidInvoiceTargetId(invoiceId);
    setVoidReason("");
    setVoidError("");
    setVoidDialogOpen(true);
  };

  const closeVoidInvoiceDialog = () => {
    setVoidDialogOpen(false);
    setVoidInvoiceTargetId(null);
    setVoidReason("");
    setVoidError("");
  };

  const confirmVoidInvoice = async () => {
    const id = voidInvoiceTargetId?.trim();
    if (!id) {
      return;
    }
    if (!voidReason.trim()) {
      setVoidError("Void reason is required.");
      return;
    }
    setVoidError("");
    setBusy("void");
    try {
      await voidInvoice(id, voidReason.trim());
      setActionMessage(`Invoice voided: ${id}`);
      closeVoidInvoiceDialog();
      await loadPayments();
      await loadInvoicesFirstPage();
    } catch (caught) {
      setVoidError(
        toErrorMessage(caught, "Void failed.", { honorBackendMessage: true }),
      );
    } finally {
      setBusy(null);
    }
  };

  const openDeleteDraftInvoiceDialog = (invoiceId: string) => {
    setDeleteDraftInvoiceId(invoiceId);
    setDeleteDraftError("");
    setDeleteDraftDialogOpen(true);
  };

  const closeDeleteDraftInvoiceDialog = () => {
    setDeleteDraftDialogOpen(false);
    setDeleteDraftInvoiceId(null);
    setDeleteDraftError("");
  };

  const confirmDeleteDraftInvoice = async () => {
    const id = deleteDraftInvoiceId?.trim();
    if (!id) {
      return;
    }
    setDeleteDraftError("");
    setBusy("delete-draft");
    try {
      await deleteDraftCustomerInvoice(id);
      setActionMessage(`Draft invoice deleted: ${id}`);
      closeDeleteDraftInvoiceDialog();
      if (selectedInvoiceId === id) {
        setSelectedInvoiceId(null);
      }
      if (allocateInvoiceId === id) {
        setAllocateInvoiceId("");
        setAllocateLineId("");
      }
      await loadPayments();
      await loadInvoicesFirstPage();
      await loadEnrollmentPicker(undefined, enrollmentFilter.trim());
    } catch (caught) {
      setDeleteDraftError(
        toErrorMessage(caught, "Delete failed.", { honorBackendMessage: true }),
      );
    } finally {
      setBusy(null);
    }
  };

  const handleEmailIssuedInvoice = async () => {
    const id = selectedInvoiceId?.trim();
    if (!id || selectedIssuedInvoice?.status !== "issued") {
      return;
    }
    const normalized = normalizeInvoiceRecipientList(issuedInvoiceEmailCsv);
    if (normalized === "") {
      setIssuedInvoiceEmailError(
        "Enter at least one recipient email (comma-separated).",
      );
      return;
    }
    setIssuedInvoiceEmailError("");
    setBusy("email");
    try {
      const out = await emailInvoice(id, normalized);
      setActionMessage(
        out.sent ? "Email send accepted." : "Email was not confirmed sent.",
      );
      await loadInvoicesFirstPage();
    } catch (caught) {
      setIssuedInvoiceEmailError(
        toErrorMessage(caught, "Email failed.", { honorBackendMessage: true }),
      );
    } finally {
      setBusy(null);
    }
  };

  const handleIssueRow = async (invoiceId: string) => {
    setActionError("");
    setActionMessage("");
    setBusy("issue");
    try {
      const out = await issueInvoice(invoiceId);
      setActionMessage(
        `Issued invoice ${out.invoiceNumber ?? out.invoiceId ?? invoiceId}` +
          (out.issuedPdfSha256
            ? ` (SHA-256: ${out.issuedPdfSha256.slice(0, 16)}…)`
            : ""),
      );
      await loadInvoicesFirstPage();
    } catch (caught) {
      setActionError(
        toErrorMessage(caught, "Issue failed.", { honorBackendMessage: true }),
      );
    } finally {
      setBusy(null);
    }
  };

  const handleOpenInvoicePdfPreview = async (invoiceId: string) => {
    setActionError("");
    setBusy("pdf");
    try {
      const { downloadUrl } = await getCustomerInvoicePdfDownload(invoiceId);
      window.open(downloadUrl, "_blank", "noopener,noreferrer");
    } catch (caught) {
      setActionError(
        toErrorMessage(caught, "Could not open invoice preview.", {
          honorBackendMessage: true,
        }),
      );
    } finally {
      setBusy(null);
    }
  };

  const openConfirmPaymentDialog = (paymentId: string) => {
    setConfirmPaymentId(paymentId);
    setConfirmPaymentExternalRef("");
    setConfirmPaymentError("");
    setConfirmPaymentDialogOpen(true);
  };

  const closeConfirmPaymentDialog = () => {
    setConfirmPaymentDialogOpen(false);
    setConfirmPaymentId(null);
    setConfirmPaymentExternalRef("");
    setConfirmPaymentError("");
  };

  const submitConfirmPayment = async () => {
    if (!confirmPaymentId) {
      return;
    }
    setConfirmPaymentError("");
    setBusy("confirm");
    try {
      const ext = confirmPaymentExternalRef.trim();
      await confirmCustomerPayment(
        confirmPaymentId,
        ext === "" ? undefined : { externalReference: ext },
      );
      setActionMessage("Payment confirmed.");
      closeConfirmPaymentDialog();
      await loadPayments();
      if (selectedId === confirmPaymentId) {
        const ac = new AbortController();
        await loadDetail(confirmPaymentId, ac.signal);
      }
    } catch (caught) {
      setConfirmPaymentError(
        toErrorMessage(caught, "Confirm failed.", {
          honorBackendMessage: true,
        }),
      );
    } finally {
      setBusy(null);
    }
  };

  const openDeletePaymentDialog = (paymentId: string) => {
    setDeletePaymentId(paymentId);
    setDeletePaymentError("");
    setDeletePaymentDialogOpen(true);
  };

  const closeDeletePaymentDialog = () => {
    setDeletePaymentDialogOpen(false);
    setDeletePaymentId(null);
    setDeletePaymentError("");
  };

  const submitDeletePayment = async () => {
    const id = deletePaymentId?.trim();
    if (!id) {
      return;
    }
    setDeletePaymentError("");
    setBusy("delete-payment");
    try {
      await deleteCustomerPayment(id);
      setActionMessage(`Payment deleted: ${id}`);
      closeDeletePaymentDialog();
      await loadPayments();
      if (selectedId === id) {
        setSelectedId(null);
        setDetail(null);
      }
    } catch (caught) {
      setDeletePaymentError(
        toErrorMessage(caught, "Delete failed.", { honorBackendMessage: true }),
      );
    } finally {
      setBusy(null);
    }
  };

  const handleCreateDraft = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setActionError("");
    setActionMessage("");
    const ids = [...selectedEnrollmentIds];
    if (ids.length === 0) {
      setActionError("Select at least one enrollment.");
      return;
    }
    const rowsById = new Map(
      enrollmentPickerRows.map((r) => [r.enrollmentId, r]),
    );
    for (const id of ids) {
      const row = rowsById.get(id);
      if (!row || row.invoiceLinked) {
        setActionError(
          "The enrollment list changed; update your selection and try again.",
        );
        return;
      }
    }
    const overrides: Record<string, string> = {};
    for (const id of ids) {
      const row = rowsById.get(id);
      if (!row) {
        continue;
      }
      const raw = lineOverrideByEnrollmentId[id] ?? defaultLineAmount(row);
      const trimmed = raw.trim();
      const normalized = trimmed === "" ? defaultLineAmount(row) : trimmed;
      if (lineAmountsDiffer(normalized, row)) {
        overrides[id] = normalized;
      }
    }
    if (draftSelectionIssue) {
      setActionError(draftSelectionIssue);
      return;
    }
    if (draftAmountIssue) {
      setActionError(draftAmountIssue);
      return;
    }
    setBusy("draft");
    try {
      const body: Parameters<typeof createDraftInvoice>[0] = {
        draftKind: "enrollment_merge",
        enrollmentIds: ids,
      };
      if (Object.keys(overrides).length > 0) {
        body.lineTotalsByEnrollmentId = overrides;
      }
      if (draftInvoiceDate.trim() !== "") {
        body.invoiceDate = draftInvoiceDate.trim();
      }
      const result = await createDraftInvoice(body);
      setSelectedInvoiceId(result.invoiceId);
      setAllocateInvoiceId("");
      setAllocateLineId("");
      setActionMessage(`Draft invoice created: ${result.invoiceId}`);
      setDraftInvoiceDate(localTodayYmd());
      await loadPayments();
      await loadInvoicesFirstPage();
      await loadEnrollmentPicker(undefined, enrollmentFilter.trim());
    } catch (caught) {
      setActionError(
        toErrorMessage(caught, "Create draft failed.", {
          honorBackendMessage: true,
        }),
      );
    } finally {
      setBusy(null);
    }
  };

  const handleAllocate = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setActionError("");
    setActionMessage("");
    if (!selectedId) {
      setActionError("Select a payment row first.");
      return;
    }
    const invId = allocateInvoiceId.trim();
    if (!invId) {
      setActionError("Select an issued invoice for allocation.");
      return;
    }
    const allocateTarget = invoices.find((i) => i.id === invId);
    if (!allocateTarget || allocateTarget.status !== "issued") {
      setActionError("Select an issued invoice for allocation.");
      return;
    }
    const amt = allocateAmount.trim();
    if (!amt) {
      setActionError("Allocated amount is required.");
      return;
    }
    setBusy("allocate");
    try {
      const out = await createPaymentAllocation({
        paymentId: selectedId,
        invoiceId: invId,
        invoiceLineId:
          allocateLineId.trim() === "" ? null : allocateLineId.trim(),
        allocatedAmount: amt,
        currency: allocateCurrency.trim().toUpperCase() || defaultCurrency,
      });
      setActionMessage(`Allocation created: ${out.allocationId}`);
      await loadPayments();
      const ac = new AbortController();
      await loadDetail(selectedId, ac.signal);
      await loadInvoicesFirstPage();
    } catch (caught) {
      setActionError(
        toErrorMessage(caught, "Allocation failed.", {
          honorBackendMessage: true,
        }),
      );
    } finally {
      setBusy(null);
    }
  };

  const handleRefund = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setActionError("");
    setActionMessage("");
    const orig = refundPaymentSelectId.trim();
    if (!orig) {
      setActionError("Select an inbound payment allocated to the invoice.");
      return;
    }
    const amt = refundAmount.trim();
    if (!amt) {
      setActionError("Refund amount is required.");
      return;
    }
    setBusy("refund");
    try {
      await createCustomerRefund({
        direction: "refund",
        originalPaymentId: orig,
        amount: amt,
        currency: refundCurrency.trim().toUpperCase() || defaultCurrency,
        method: refundMethod.trim() === "" ? undefined : refundMethod.trim(),
        stripeRefundId:
          refundStripeId.trim() === "" ? null : refundStripeId.trim(),
      });
      setActionMessage("Refund payment row recorded.");
      await loadPayments();
      setRefundInvoicePaymentsRefresh((n) => n + 1);
    } catch (caught) {
      setActionError(
        toErrorMessage(caught, "Refund failed.", { honorBackendMessage: true }),
      );
    } finally {
      setBusy(null);
    }
  };

  const manualPaymentIsUpdate = useMemo(() => {
    if (!selectedId || manualPaymentPreferCreateForm) {
      return false;
    }
    const row = payments.find((p) => p.id === selectedId);
    return isManualInboundPaymentEditable(row);
  }, [payments, selectedId, manualPaymentPreferCreateForm]);

  const manualPaymentSucceededReadOnly = Boolean(
    manualPaymentIsUpdate &&
    detail?.id === selectedId &&
    detail.status === "succeeded",
  );

  const manualPaymentEnrollmentEditLabel = useMemo(() => {
    if (!manualPaymentIsUpdate || !selectedId) {
      return "";
    }
    const enrollmentId =
      detail?.id === selectedId && (detail.enrollmentId?.trim() ?? "") !== ""
        ? detail.enrollmentId!.trim()
        : createPaymentEnrollmentId.trim();
    const partyFallback = (
      (detail?.id === selectedId ? detail.party : undefined) ??
      payments.find((x) => x.id === selectedId)?.party ??
      ""
    ).trim();
    if (enrollmentId === "") {
      return partyFallback !== "" ? partyFallback : "—";
    }
    const row = enrollmentPickerRows.find((r) => r.enrollmentId === enrollmentId);
    return formatManualPaymentEnrollmentEditLabel(row, partyFallback);
  }, [
    manualPaymentIsUpdate,
    selectedId,
    detail,
    payments,
    createPaymentEnrollmentId,
    enrollmentPickerRows,
  ]);

  const handleCancelManualPayment = () => {
    setActionError("");
    setManualPaymentPreferCreateForm(true);
    resetManualPaymentCreateFields();
  };

  const handleManualPaymentFormSubmit = async (
    event: FormEvent<HTMLFormElement>,
  ) => {
    event.preventDefault();
    setActionError("");
    setActionMessage("");
    const amt = createPaymentAmount.trim();
    if (!amt) {
      setActionError("Amount is required.");
      return;
    }
    if (manualPaymentIsUpdate) {
      const id = selectedId?.trim();
      if (!id) {
        return;
      }
      setBusy("update-payment");
      try {
        await updateManualInboundCustomerPayment(id, {
          amount: amt,
          currency:
            createPaymentCurrency.trim().toUpperCase() || defaultCurrency,
          method: createPaymentMethod.trim(),
          status: createPaymentStatus,
          externalReference:
            createPaymentExternalRef.trim() === ""
              ? null
              : createPaymentExternalRef.trim(),
        });
        setActionMessage("Customer payment updated.");
        await loadPayments();
        const ac = new AbortController();
        await loadDetail(id, ac.signal);
      } catch (caught) {
        setActionError(
          toErrorMessage(caught, "Update payment failed.", {
            honorBackendMessage: true,
          }),
        );
      } finally {
        setBusy(null);
      }
      return;
    }
    const rawEnrollment = createPaymentEnrollmentId.trim();
    if (rawEnrollment === "") {
      setActionError(
        "Select a recent enrollment or choose none to record without an enrollment.",
      );
      return;
    }
    const enrollmentId =
      rawEnrollment === NO_ENROLLMENT_OPTION_VALUE ? null : rawEnrollment;
    setBusy("create-payment");
    try {
      const pay = await createManualInboundCustomerPayment({
        direction: "inbound",
        enrollmentId,
        amount: amt,
        currency: createPaymentCurrency.trim().toUpperCase() || defaultCurrency,
        method: createPaymentMethod.trim(),
        status: createPaymentStatus,
        externalReference:
          createPaymentExternalRef.trim() === ""
            ? null
            : createPaymentExternalRef.trim(),
      });
      setActionMessage("Customer payment recorded.");
      resetManualPaymentCreateFields();
      await loadPayments();
      const pid = pay.id?.trim() ?? "";
      if (pid) {
        setSelectedId(pid);
        const ac = new AbortController();
        await loadDetail(pid, ac.signal);
      }
    } catch (caught) {
      setActionError(
        toErrorMessage(caught, "Create payment failed.", {
          honorBackendMessage: true,
        }),
      );
    } finally {
      setBusy(null);
    }
  };

  const handleExport = async () => {
    setExportBusy(true);
    setActionError("");
    try {
      const csv = await exportBillingCsv("2");
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `billing-export-${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      setActionMessage("Export downloaded (v2 CSV).");
    } catch (caught) {
      setActionError(
        toErrorMessage(caught, "Export failed.", { honorBackendMessage: true }),
      );
    } finally {
      setExportBusy(false);
    }
  };

  const editorBusy = busyAction !== null;

  return {
    ids: {
      draftFilterId,
      draftModeId,
      invoiceSearchFilterId,
      invoiceSettlementFilterId,
      draftInvoiceDateId,
    },
    currency: {
      currencyOptions,
      defaultCurrency,
    },
    banners: {
      actionMessage,
      actionError,
    },
    busy: {
      busyAction,
      editorBusy,
      exportBusy,
    },
    draft: {
      draftCreationMode,
      setDraftCreationMode,
      customizedFormSubmitEnabled,
      setCustomizedFormSubmitEnabled,
      enrollmentFilter,
      setEnrollmentFilter,
      enrollmentPickerRows,
      enrollmentPickerTruncated,
      enrollmentPickerLoading,
      enrollmentPickerError,
      selectedEnrollmentIds,
      setSelectedEnrollmentIds,
      lineOverrideByEnrollmentId,
      setLineOverrideByEnrollmentId,
      draftInvoiceDateMin,
      draftInvoiceDateMax,
      draftInvoiceDate,
      setDraftInvoiceDate,
      selectableFilteredRows,
      selectedEnrollmentRows,
      draftSelectionIssue,
      draftAmountIssue,
      handleCreateDraft,
      loadPayments,
      loadInvoicesFirstPage,
      setBusy,
      setActionError,
      setSelectedInvoiceId,
      setAllocateInvoiceId,
      setAllocateLineId,
      setActionMessage,
    },
    invoices: {
      invoices,
      invoiceListLoading,
      invoiceListLoadingMore,
      invoiceListError,
      invoiceListCursor,
      invoiceStatusFilter,
      setInvoiceStatusFilter,
      invoiceSettlementFilter,
      setInvoiceSettlementFilter,
      invoiceCurrencyFilter,
      setInvoiceCurrencyFilter,
      invoiceSearchInput,
      setInvoiceSearchInput,
      selectedInvoiceId,
      setSelectedInvoiceId,
      selectedIssuedInvoice,
      issuedInvoiceEmailCsv,
      setIssuedInvoiceEmailCsv,
      issuedInvoiceEmailError,
      setIssuedInvoiceEmailError,
      issuedInvoiceEmailDirtyRef,
      handleEmailIssuedInvoice,
      loadMoreInvoices,
      handleOpenInvoicePdfPreview,
      handleIssueRow,
      openVoidInvoiceDialog,
      openDeleteDraftInvoiceDialog,
      deleteDraftDialogOpen,
      voidDialogOpen,
      setAllocateInvoiceId,
      setAllocateLineId,
    },
    manualPayment: {
      createPaymentEnrollmentId,
      setCreatePaymentEnrollmentId,
      createPaymentEnrollmentPickerValue,
      createPaymentAmount,
      setCreatePaymentAmount,
      createPaymentCurrency,
      setCreatePaymentCurrency,
      createPaymentMethod,
      setCreatePaymentMethod,
      createPaymentStatus,
      setCreatePaymentStatus,
      createPaymentExternalRef,
      setCreatePaymentExternalRef,
      manualPaymentIsUpdate,
      manualPaymentSucceededReadOnly,
      manualPaymentEnrollmentEditLabel,
      handleCancelManualPayment,
      handleManualPaymentFormSubmit,
      enrollmentPickerRows,
    },
    payments: {
      payments,
      listLoading,
      listError,
      selectedId,
      setSelectedId,
      setManualPaymentPreferCreateForm,
      exportBusy,
      handleExport,
      openConfirmPaymentDialog,
      openDeletePaymentDialog,
      confirmPaymentId,
      deletePaymentDialogOpen,
      confirmPaymentDialogOpen,
    },
    allocate: {
      allocateInvoiceId,
      setAllocateInvoiceId,
      allocateLineId,
      setAllocateLineId,
      allocateAmount,
      setAllocateAmount,
      allocateCurrency,
      setAllocateCurrency,
      allocateInvoiceLines,
      allocateInvoiceLinesLoading,
      allocateInvoiceLinesError,
      allocateLinesOrdered,
      allocateLineDescriptionCounts,
      issuedInvoicesForAllocate,
      handleAllocate,
      invoices,
    },
    refund: {
      refundInvoiceId,
      setRefundInvoiceId,
      refundPaymentSelectId,
      setRefundPaymentSelectId,
      refundPaymentsLoading,
      refundPaymentsError,
      refundEligiblePayments,
      refundAmount,
      setRefundAmount,
      refundCurrency,
      setRefundCurrency,
      refundMethod,
      setRefundMethod,
      refundStripeId,
      setRefundStripeId,
      issuedInvoicesForAllocate,
      handleRefund,
    },
    dialogs: {
      voidDialogOpen,
      voidReason,
      setVoidReason,
      voidError,
      setVoidError,
      closeVoidInvoiceDialog,
      confirmVoidInvoice,
      deleteDraftDialogOpen,
      deleteDraftError,
      closeDeleteDraftInvoiceDialog,
      confirmDeleteDraftInvoice,
      confirmPaymentDialogOpen,
      confirmPaymentExternalRef,
      setConfirmPaymentExternalRef,
      confirmPaymentError,
      setConfirmPaymentError,
      closeConfirmPaymentDialog,
      submitConfirmPayment,
      deletePaymentDialogOpen,
      deletePaymentError,
      closeDeletePaymentDialog,
      submitDeletePayment,
    },
  };
}
