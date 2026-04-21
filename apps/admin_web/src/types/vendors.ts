/** Vendor rows are organizations with `relationship_type: vendor` (Finance UI view-model). */
export interface Vendor {
  id: string;
  name: string;
  website: string | null;
  active: boolean;
  archivedAt: string | null;
  createdAt: string | null;
  updatedAt: string | null;
}

export interface VendorFilters {
  query: string;
  active: '' | 'true' | 'false';
}

export const DEFAULT_VENDOR_FILTERS: VendorFilters = {
  query: '',
  active: '',
};
