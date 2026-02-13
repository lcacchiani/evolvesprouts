import type { ReactNode } from 'react';

import type { FooterContent, NavbarContent } from '@/content';
import { Footer } from '@/components/sections/footer';
import { Navbar } from '@/components/sections/navbar';

interface PageLayoutProps {
  navbarContent: NavbarContent;
  footerContent: FooterContent;
  children: ReactNode;
  mainClassName?: string;
  mainId?: string;
}

const DEFAULT_MAIN_CLASSNAME = 'min-h-screen';

export function PageLayout({
  navbarContent,
  footerContent,
  children,
  mainClassName,
  mainId = 'main-content',
}: PageLayoutProps) {
  return (
    <>
      <Navbar content={navbarContent} />
      <main
        id={mainId}
        tabIndex={-1}
        className={mainClassName ?? DEFAULT_MAIN_CLASSNAME}
      >
        {children}
      </main>
      <Footer content={footerContent} />
    </>
  );
}
