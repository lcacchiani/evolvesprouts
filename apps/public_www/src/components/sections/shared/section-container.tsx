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
