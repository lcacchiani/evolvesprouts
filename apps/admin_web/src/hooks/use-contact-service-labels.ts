'use client';

import { useEffect } from 'react';

import { listAdminContactServices } from '@/lib/entity-api';

export function useContactServiceLabels(
  editorMode: 'create' | 'edit',
  selectedId: string | null,
  setServiceLabelsState: (value: { entityId: string; labels: string[] } | null) => void
) {
  useEffect(() => {
    if (editorMode !== 'edit' || !selectedId) {
      return;
    }
    const entityId = selectedId;
    const controller = new AbortController();
    let cancelled = false;
    void (async () => {
      try {
        const labels = await listAdminContactServices(entityId, controller.signal);
        if (!cancelled) {
          setServiceLabelsState({ entityId, labels });
        }
      } catch {
        if (!cancelled) {
          setServiceLabelsState({ entityId, labels: [] });
        }
      }
    })();
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [selectedId, editorMode, setServiceLabelsState]);
}
