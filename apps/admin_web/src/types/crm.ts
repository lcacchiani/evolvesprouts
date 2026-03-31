export interface CrmListFilters {
  query: string;
  active: '' | 'true' | 'false';
}

export const DEFAULT_CRM_LIST_FILTERS: CrmListFilters = {
  query: '',
  active: '',
};
