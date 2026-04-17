export const ADMIN_NAV_ITEMS = [
  { key: 'assets', label: 'Assets', href: '/assets' },
  { key: 'contacts', label: 'Contacts', href: '/contacts' },
  { key: 'finance', label: 'Finance', href: '/finance' },
  { key: 'sales', label: 'Sales', href: '/sales' },
  { key: 'services', label: 'Services', href: '/services' },
] as const;

export type AdminSectionKey = (typeof ADMIN_NAV_ITEMS)[number]['key'];

export const DEFAULT_ADMIN_SECTION_PATH = '/finance' as const;

export function adminSectionKeyFromPathname(pathname: string): AdminSectionKey {
  const match = ADMIN_NAV_ITEMS.find((item) => item.href === pathname);
  return match?.key ?? 'finance';
}
