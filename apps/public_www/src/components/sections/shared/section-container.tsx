import type {
  ComponentPropsWithoutRef,
  ElementType,
  ReactNode,
} from 'react';

import { mergeClassNames } from '@/lib/class-name-utils';

type SectionContainerProps<T extends ElementType = 'div'> = {
  as?: T;
  className?: string;
  children: ReactNode;
} & Omit<ComponentPropsWithoutRef<T>, 'as' | 'className' | 'children'>;

export const SECTION_SPLIT_LAYOUT_CLASSNAME = 'grid lg:grid-cols-2';

export function buildSectionSplitLayoutClassName(className?: string): string {
  return mergeClassNames(SECTION_SPLIT_LAYOUT_CLASSNAME, className);
}

export function SectionContainer<T extends ElementType = 'div'>({
  as,
  className,
  children,
  ...props
}: SectionContainerProps<T>) {
  const Tag = as ?? 'div';

  return (
    <Tag
      className={mergeClassNames('es-layout-container', className)}
      {...props}
    >
      {children}
    </Tag>
  );
}
