'use client';

import { useEffect, useState } from 'react';

import {
  listEntityFamilyPicker,
  listEntityOrganizationPicker,
  type EntityPickerListItem,
} from '@/lib/entity-api';

export function useFamilyOrgPickers() {
  const [familyPicker, setFamilyPicker] = useState<EntityPickerListItem[]>([]);
  const [organizationPicker, setOrganizationPicker] = useState<EntityPickerListItem[]>([]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const [families, organizations] = await Promise.all([
          listEntityFamilyPicker(),
          listEntityOrganizationPicker(),
        ]);
        if (!cancelled) {
          setFamilyPicker(Array.isArray(families) ? families : []);
          setOrganizationPicker(Array.isArray(organizations) ? organizations : []);
        }
      } catch {
        if (!cancelled) {
          setFamilyPicker([]);
          setOrganizationPicker([]);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return { familyPicker, organizationPicker };
}
