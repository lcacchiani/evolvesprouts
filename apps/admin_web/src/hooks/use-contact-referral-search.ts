'use client';

import { useEffect, useMemo } from 'react';

import { getAdminContact, searchEntityContactsForPicker, type EntityPickerListItem } from '@/lib/entity-api';
import { formatAdminContactPickerLabel } from '@/lib/format';
import type { components } from '@/types/generated/admin-api.generated';

type ApiSchemas = components['schemas'];

export function useContactReferralSearch(input: {
  source: ApiSchemas['EntityContactSource'];
  editorMode: 'create' | 'edit';
  selectedId: string | null;
  referralSearchInput: string;
  referralContactId: string;
  referralSearchResults: EntityPickerListItem[];
  referralPinnedLabel: string;
  setReferralSearchResults: (items: EntityPickerListItem[]) => void;
  setReferralPinnedLabel: (label: string) => void;
}) {
  const {
    source,
    editorMode,
    selectedId,
    referralSearchInput,
    referralContactId,
    referralSearchResults,
    referralPinnedLabel,
    setReferralSearchResults,
    setReferralPinnedLabel,
  } = input;

  const referralSelectOptions = useMemo(() => {
    const byId = new Map<string, string>();
    for (const r of referralSearchResults) {
      byId.set(r.id, r.label);
    }
    const rid = referralContactId.trim();
    if (rid && referralPinnedLabel.trim() && !byId.has(rid)) {
      byId.set(rid, referralPinnedLabel.trim());
    }
    return Array.from(byId.entries()).map(([id, label]) => ({ id, label }));
  }, [referralSearchResults, referralContactId, referralPinnedLabel]);

  useEffect(() => {
    if (source !== 'referral') {
      queueMicrotask(() => {
        setReferralSearchResults([]);
      });
      return;
    }
    const q = referralSearchInput.trim();
    if (q.length < 2) {
      queueMicrotask(() => {
        setReferralSearchResults([]);
      });
      return;
    }
    let cancelled = false;
    const handle = setTimeout(() => {
      void (async () => {
        try {
          const items = await searchEntityContactsForPicker({
            query: q,
            excludeContactId: editorMode === 'edit' ? selectedId : null,
            limit: 50,
          });
          if (!cancelled) {
            setReferralSearchResults(Array.isArray(items) ? items : []);
          }
        } catch {
          if (!cancelled) {
            setReferralSearchResults([]);
          }
        }
      })();
    }, 300);
    return () => {
      cancelled = true;
      clearTimeout(handle);
    };
  }, [referralSearchInput, source, selectedId, editorMode, setReferralSearchResults]);

  useEffect(() => {
    if (source !== 'referral' || !referralContactId.trim()) {
      queueMicrotask(() => {
        setReferralPinnedLabel('');
      });
      return;
    }
    const id = referralContactId.trim();
    let cancelled = false;
    void (async () => {
      try {
        const c = await getAdminContact(id);
        if (cancelled || !c) {
          return;
        }
        setReferralPinnedLabel(formatAdminContactPickerLabel(c));
      } catch {
        if (!cancelled) {
          setReferralPinnedLabel('');
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [referralContactId, source, setReferralPinnedLabel]);

  return referralSelectOptions;
}
