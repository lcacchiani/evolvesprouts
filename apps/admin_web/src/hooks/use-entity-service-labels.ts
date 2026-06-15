'use client';

import { useEffect, useState } from 'react';

export function useEntityServiceLabels(
  editorMode: 'create' | 'edit',
  entityId: string | null,
  fetchLabels: (entityId: string, signal: AbortSignal) => Promise<string[]>
): string[] {
  const [serviceLabelsState, setServiceLabelsState] = useState<{
    entityId: string;
    labels: string[];
  } | null>(null);

  const serviceLabels =
    editorMode === 'edit' && entityId && serviceLabelsState?.entityId === entityId
      ? serviceLabelsState.labels
      : [];

  useEffect(() => {
    if (editorMode !== 'edit' || !entityId) {
      return;
    }
    const activeEntityId = entityId;
    const controller = new AbortController();
    let cancelled = false;
    void (async () => {
      try {
        const labels = await fetchLabels(activeEntityId, controller.signal);
        if (!cancelled) {
          setServiceLabelsState({ entityId: activeEntityId, labels });
        }
      } catch {
        if (!cancelled) {
          setServiceLabelsState({ entityId: activeEntityId, labels: [] });
        }
      }
    })();
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [entityId, editorMode, fetchLabels]);

  return serviceLabels;
}
