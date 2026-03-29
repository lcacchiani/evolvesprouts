import Image from 'next/image';

export type HeroQuickFactChipType =
  | 'category'
  | 'cohort'
  | 'date'
  | 'duration'
  | 'location'
  | 'price'
  | 'time'
  | 'visits';

export interface HeroQuickFactChip {
  type: HeroQuickFactChipType;
  label: string;
}

const CALENDAR_ICON_SRC = '/images/calendar.svg';
const CLOCK_ICON_SRC = '/images/clock.svg';
const DOLLAR_ICON_SRC = '/images/dollar-symbol.svg';
const HOME_ICON_SRC = '/images/home.svg';
const LOCATION_ICON_SRC = '/images/location.svg';

export function resolveHeroQuickFactChipIconSource(
  type: HeroQuickFactChipType,
): string | null {
  if (type === 'date' || type === 'cohort') {
    return CALENDAR_ICON_SRC;
  }
  if (type === 'time' || type === 'duration') {
    return CLOCK_ICON_SRC;
  }
  if (type === 'location') {
    return LOCATION_ICON_SRC;
  }
  if (type === 'price') {
    return DOLLAR_ICON_SRC;
  }
  if (type === 'visits') {
    return HOME_ICON_SRC;
  }

  return null;
}

interface HeroQuickFactChipsProps {
  chips: readonly HeroQuickFactChip[];
  className?: string;
  'data-testid'?: string;
}

export function HeroQuickFactChips({
  chips,
  className,
  'data-testid': dataTestId,
}: HeroQuickFactChipsProps) {
  if (chips.length === 0) {
    return null;
  }

  const rootClassName = ['flex flex-wrap gap-3', className]
    .filter(Boolean)
    .join(' ');

  return (
    <div className={rootClassName} data-testid={dataTestId}>
      {chips.map((chip, index) => {
        const iconSource = resolveHeroQuickFactChipIconSource(chip.type);
        return (
          <span
            key={`${chip.label}-${index}`}
            className='inline-flex items-center gap-1.5 rounded-full border es-border-soft es-bg-surface-soft px-4 py-2 text-sm font-semibold es-text-heading'
          >
            {iconSource ? (
              <Image
                src={iconSource}
                alt=''
                aria-hidden='true'
                width={14}
                height={14}
                className='h-3.5 w-3.5 shrink-0 self-center'
              />
            ) : null}
            <span className='inline-flex items-center'>{chip.label}</span>
          </span>
        );
      })}
    </div>
  );
}
