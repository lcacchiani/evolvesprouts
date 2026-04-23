export type PartnerFilters = {
  query: string;
  active: '' | 'true' | 'false';
};

export const DEFAULT_PARTNER_FILTERS: PartnerFilters = {
  query: '',
  active: '',
};
