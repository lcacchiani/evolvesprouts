import { normalizeLocalizedPath } from '@/lib/locale-routing';

export interface MenuHrefItem {
  href: string;
}

export interface MenuItemWithChildren extends MenuHrefItem {
  children?: readonly MenuHrefItem[];
}

export function isHrefActive(currentPath: string, href: string): boolean {
  const targetPath = normalizeLocalizedPath(href);

  if (targetPath === '#') {
    return false;
  }

  if (targetPath === '/') {
    return currentPath === '/';
  }

  return currentPath === targetPath || currentPath.startsWith(`${targetPath}/`);
}

export function isMenuItemActive(currentPath: string, item: MenuItemWithChildren): boolean {
  if (isHrefActive(currentPath, item.href)) {
    return true;
  }

  if (!item.children) {
    return false;
  }

  return item.children.some((child) => isHrefActive(currentPath, child.href));
}
