import type { components } from '@/types/generated/admin-api.generated';

type CrmContactType = components['schemas']['CrmContactType'];

export interface CrmListFilters {
  query: string;
  active: '' | 'true' | 'false';
  /** Empty string means no filter (contacts list only). */
  contact_type: '' | CrmContactType;
}

export const DEFAULT_CRM_LIST_FILTERS: CrmListFilters = {
  query: '',
  active: '',
  contact_type: '',
};

/** Default filters for the contacts table (Active contacts only). */
export const DEFAULT_CONTACT_LIST_FILTERS: CrmListFilters = {
  query: '',
  active: 'true',
  contact_type: '',
};
