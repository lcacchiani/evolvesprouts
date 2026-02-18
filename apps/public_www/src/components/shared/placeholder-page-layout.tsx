import type { ReactNode } from 'react';

import type { FooterContent, NavbarContent } from '@/content';
import { PageLayout } from '@/components/shared/page-layout';

const DEFAULT_PLACEHOLDER_MAIN_CLASSNAME =
  'mx-auto flex min-h-[52vh] w-full max-w-[1465px] items-center px-4 py-16 sm:px-6 lg:px-8';

interface PlaceholderPageLayoutProps {
  navbarContent: NavbarContent;
  footerContent: FooterContent;
  children: ReactNode;
  mainClassName?: string;
}

export function PlaceholderPageLayout({
  navbarContent,
  footerContent,
  children,
  mainClassName,
}: PlaceholderPageLayoutProps) {
  return (
    <PageLayout
      navbarContent={navbarContent}
      footerContent={footerContent}
      mainClassName={mainClassName ?? DEFAULT_PLACEHOLDER_MAIN_CLASSNAME}
    >
      {children}
    </PageLayout>
  );
}
