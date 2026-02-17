import type { ReactNode } from 'react';

import { SectionEyebrowChip } from '@/components/section-eyebrow-chip';

type SectionHeaderAlignment = 'center' | 'left';
type SectionHeaderTitleTag = 'h1' | 'h2';

interface SectionHeaderProps {
  eyebrow?: string;
  title: ReactNode;
  description?: ReactNode;
  align?: SectionHeaderAlignment;
  titleAs?: SectionHeaderTitleTag;
  className?: string;
  titleClassName?: string;
  descriptionClassName?: string;
  testId?: string;
}

function mergeClassNames(...values: Array<string | undefined>): string {
  return values.filter((value): value is string => Boolean(value)).join(' ');
}

export function SectionHeader({
  eyebrow,
  title,
  description,
  align = 'center',
  titleAs = 'h2',
  className,
  titleClassName,
  descriptionClassName,
  testId,
}: SectionHeaderProps) {
  const TitleTag = titleAs;
  const alignmentClassName =
    align === 'left'
      ? 'es-section-header--left text-left'
      : 'es-section-header--center text-center';

  return (
    <div
      data-testid={testId}
      className={mergeClassNames(
        'es-section-header',
        alignmentClassName,
        className,
      )}
    >
      {eyebrow ? <SectionEyebrowChip label={eyebrow} /> : null}
      <TitleTag className={mergeClassNames('es-type-title mt-6', titleClassName)}>
        {title}
      </TitleTag>
      {description ? (
        <p className={descriptionClassName ?? 'es-type-body mt-4'}>
          {description}
        </p>
      ) : null}
    </div>
  );
}
