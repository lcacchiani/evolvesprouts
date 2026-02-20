import type { ReactNode } from 'react';

import { SectionEyebrowChip } from '@/components/sections/shared/section-eyebrow-chip';
import { mergeClassNames } from '@/lib/class-name-utils';

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
  const titleSpacingClassName = eyebrow ? 'mt-6' : undefined;
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
      <TitleTag
        className={mergeClassNames(
          'es-type-title',
          titleSpacingClassName,
          titleClassName,
        )}
      >
        {title}
      </TitleTag>
      {description ? (
        <p
          className={mergeClassNames(
            'es-section-header-description',
            descriptionClassName ?? 'es-type-body mt-4',
          )}
        >
          {description}
        </p>
      ) : null}
    </div>
  );
}
