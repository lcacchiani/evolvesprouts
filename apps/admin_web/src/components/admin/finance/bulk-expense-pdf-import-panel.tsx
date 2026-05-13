'use client';

import { useState } from 'react';

import { StatusBanner } from '@/components/status-banner';
import { Button } from '@/components/ui/button';
import { AdminEditorCard } from '@/components/ui/admin-editor-card';
import { FileUploadButton } from '@/components/ui/file-upload-button';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import type { Vendor } from '@/types/vendors';

interface BulkExpensePdfImportPanelProps {
  vendorOptions: Vendor[];
  isLoadingVendors: boolean;
  isBusy: boolean;
  error: string;
  onImport: (payload: { file: File; defaultVendorId: string }) => Promise<void>;
}

export function BulkExpensePdfImportPanel({
  vendorOptions,
  isLoadingVendors,
  isBusy,
  error,
  onImport,
}: BulkExpensePdfImportPanelProps) {
  const [file, setFile] = useState<File | null>(null);
  const [defaultVendorId, setDefaultVendorId] = useState('');
  const [formKey, setFormKey] = useState(0);

  const vendorRequired = defaultVendorId.trim().length === 0;
  const submitDisabled = isBusy || vendorRequired || !file;

  async function handleSubmit() {
    if (!file || vendorRequired) {
      return;
    }
    await onImport({ file, defaultVendorId: defaultVendorId.trim() });
    setFile(null);
    setDefaultVendorId('');
    setFormKey((value) => value + 1);
  }

  return (
    <AdminEditorCard
      key={formKey}
      title='Import from combined PDF'
      description='Upload one PDF that lists several expenses. OpenRouter extracts rows the same way as queued invoice parsing; each row becomes an expense that shares this PDF attachment. When a row has no matching vendor name, the default vendor below is used.'
      actions={
        <Button
          type='submit'
          form='bulk-expense-pdf-import'
          disabled={submitDisabled}
        >
          {isBusy ? 'Working...' : 'Parse PDF and create expenses'}
        </Button>
      }
    >
      {error ? (
        <StatusBanner variant='error' title='Bulk import'>
          {error}
        </StatusBanner>
      ) : null}
      <form
        id='bulk-expense-pdf-import'
        className='space-y-3'
        onSubmit={(event) => {
          event.preventDefault();
          void handleSubmit();
        }}
      >
        <div>
          <Label htmlFor='bulk-expense-pdf-default-vendor'>
            Default vendor
            <span aria-hidden='true' className='ml-0.5 text-red-600'>
              *
            </span>
          </Label>
          <Select
            id='bulk-expense-pdf-default-vendor'
            value={defaultVendorId}
            onChange={(event) => setDefaultVendorId(event.target.value)}
            required
            aria-required
            disabled={isBusy}
          >
            <option value=''>
              {isLoadingVendors ? 'Loading vendors...' : 'Select default vendor'}
            </option>
            {vendorOptions.map((vendor) => (
              <option key={vendor.id} value={vendor.id}>
                {vendor.name}
                {vendor.active ? '' : ' (Inactive)'}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <Label htmlFor='bulk-expense-pdf-file'>Combined PDF (max 15MB)</Label>
          <FileUploadButton
            id='bulk-expense-pdf-file'
            accept='application/pdf'
            disabled={isBusy}
            selectedFileName={file?.name ?? null}
            emptyLabel='No file selected'
            buttonLabel='Choose PDF'
            onChange={(event) => {
              const picked = event.target.files?.[0] ?? null;
              setFile(picked);
            }}
          />
        </div>
      </form>
    </AdminEditorCard>
  );
}
