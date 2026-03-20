import type { components } from '@/types/generated/admin-api.generated';

type ApiSchemas = components['schemas'];
type ApiVendor = ApiSchemas['Vendor'];

export interface Vendor {
  id: ApiVendor['id'];
  name: ApiVendor['name'];
  website: ApiVendor['website'];
  active: ApiVendor['active'];
  archivedAt: ApiVendor['archived_at'];
  createdAt: ApiVendor['created_at'];
  updatedAt: ApiVendor['updated_at'];
}

export interface VendorFilters {
  query: string;
  active: '' | 'true' | 'false';
}

export const DEFAULT_VENDOR_FILTERS: VendorFilters = {
  query: '',
  active: '',
};
