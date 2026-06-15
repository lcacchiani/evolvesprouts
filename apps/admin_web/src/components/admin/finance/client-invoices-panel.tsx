"use client";

import { StatusBanner } from "@/components/status-banner";
import { ClientInvoicesAllocateEditor } from "@/components/admin/finance/client-invoices-allocate-editor";
import { ClientInvoicesBillingDialogs } from "@/components/admin/finance/client-invoices-billing-dialogs";
import { ClientInvoicesDraftEditor } from "@/components/admin/finance/client-invoices-draft-editor";
import { ClientInvoicesInvoicesTable } from "@/components/admin/finance/client-invoices-invoices-table";
import { ClientInvoicesManualPaymentEditor } from "@/components/admin/finance/client-invoices-manual-payment-editor";
import { ClientInvoicesPaymentsTable } from "@/components/admin/finance/client-invoices-payments-table";
import { ClientInvoicesRefundEditor } from "@/components/admin/finance/client-invoices-refund-editor";
import { NO_ENROLLMENT_OPTION_VALUE } from "@/components/admin/finance/client-invoices-utils";
import { useClientInvoicesPanel } from "@/hooks/use-client-invoices-panel";

export { NO_ENROLLMENT_OPTION_VALUE };

export function ClientInvoicesPanel() {
  const vm = useClientInvoicesPanel();
  const { banners } = vm;
  const { actionMessage, actionError } = banners;

  return (
    <div className="space-y-6">
      {actionMessage ? (
        <StatusBanner variant="success" title="Billing">
          {actionMessage}
        </StatusBanner>
      ) : null}
      {actionError ? (
        <StatusBanner variant="error" title="Billing">
          {actionError}
        </StatusBanner>
      ) : null}

      <ClientInvoicesDraftEditor vm={vm} />
      <ClientInvoicesInvoicesTable vm={vm} />
      <ClientInvoicesManualPaymentEditor vm={vm} />
      <ClientInvoicesPaymentsTable vm={vm} />
      <ClientInvoicesAllocateEditor vm={vm} />
      <ClientInvoicesRefundEditor vm={vm} />
      <ClientInvoicesBillingDialogs vm={vm} />
    </div>
  );
}
