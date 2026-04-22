import type { components } from '@/types/generated/admin-api.generated';

type EntityContactType = components['schemas']['EntityContactType'];

export interface EntityListFilters {
  query: string;
  active: '' | 'true' | 'false';
  /** Empty string means no filter (contacts list only). */
  contact_type: '' | EntityContactType;
}

/** Default filters for family and organization lists (active records only). */
export const DEFAULT_FAMILY_ORG_LIST_FILTERS: EntityListFilters = {
  query: '',
  active: 'true',
  contact_type: '',
};

/** Default filters for generic entity lists (all activeness). */
export const DEFAULT_LIST_FILTERS: EntityListFilters = {
  query: '',
  active: '',
  contact_type: '',
};

/** Default filters for the contacts table (Active contacts only). */
export const DEFAULT_CONTACT_LIST_FILTERS: EntityListFilters = {
  query: '',
  active: 'true',
  contact_type: '',
};
