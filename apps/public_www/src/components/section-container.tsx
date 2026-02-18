import type {
  ComponentPropsWithoutRef,
  ElementType,
  ReactNode,
} from 'react';

type SectionContainerProps<T extends ElementType = 'div'> = {
  as?: T;
  className?: string;
  children: ReactNode;
} & Omit<ComponentPropsWithoutRef<T>, 'as' | 'className' | 'children'>;

function mergeClassNames(...values: Array<string | undefined>): string {
  return values.filter((value): value is string => Boolean(value)).join(' ');
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
