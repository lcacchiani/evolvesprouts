'use client';

import { AdminCollapsibleSection } from '@/components/ui/admin-collapsible-section';
import {
  InlineLocationEditor,
  type InlineLocationEmbeddedSummary,
} from '@/components/admin/locations/inline-location-editor';
import type { GeographicAreaSummary, LocationSummary } from '@/types/services';

export interface EntityInlineLocationSectionProps {
  sectionId: string;
  stateKey: string;
  location: LocationSummary | null;
  embeddedSummary: InlineLocationEmbeddedSummary | null;
  areas: GeographicAreaSummary[];
  areasLoading: boolean;
  isSaving: boolean;
  isGeocoding: boolean;
  saveError: string;
  allowClearWhenLocked?: boolean;
  lockedSummaryExtra?: string | null;
  onSaveCreate: (
    payload: Parameters<NonNullable<Parameters<typeof InlineLocationEditor>[0]['onSaveCreate']>>[0]
  ) => Promise<string | null>;
  onSaveUpdate: (
    locationId: string,
    payload: Parameters<NonNullable<Parameters<typeof InlineLocationEditor>[0]['onSaveUpdate']>>[1]
  ) => Promise<void>;
  onClear: () => void;
  onGeocode: NonNullable<Parameters<typeof InlineLocationEditor>[0]['onGeocode']>;
}

export function EntityInlineLocationSection({
  sectionId,
  stateKey,
  location,
  embeddedSummary,
  areas,
  areasLoading,
  isSaving,
  isGeocoding,
  saveError,
  allowClearWhenLocked,
  lockedSummaryExtra,
  onSaveCreate,
  onSaveUpdate,
  onClear,
  onGeocode,
}: EntityInlineLocationSectionProps) {
  return (
    <AdminCollapsibleSection id={sectionId} title='Location'>
      <InlineLocationEditor
        stateKey={stateKey}
        location={location}
        embeddedSummary={embeddedSummary}
        areas={areas}
        areasLoading={areasLoading}
        canModify
        allowClearWhenLocked={allowClearWhenLocked}
        lockedSummaryExtra={lockedSummaryExtra}
        isSaving={isSaving}
        isGeocoding={isGeocoding}
        saveError={saveError}
        onRequestEdit={() => {}}
        onCancelEdit={() => {}}
        onSaveCreate={onSaveCreate}
        onSaveUpdate={onSaveUpdate}
        onClear={onClear}
        onGeocode={onGeocode}
      />
    </AdminCollapsibleSection>
  );
}
