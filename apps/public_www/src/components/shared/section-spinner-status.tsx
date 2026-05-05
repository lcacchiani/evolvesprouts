import { LoadingGearIcon } from '@/components/shared/loading-gear-icon';

export interface SectionSpinnerStatusProps {
  label: string;
  testId: string;
}

export function SectionSpinnerStatus({ label, testId }: SectionSpinnerStatusProps) {
  return (
    <div className='flex flex-col items-center gap-3 py-6 text-center sm:py-8'>
      <span
        role='status'
        aria-label={label}
        className='inline-flex h-12 w-12 items-center justify-center rounded-full border es-border-soft es-loading-gear-bubble'
      >
        <LoadingGearIcon className='h-7 w-7 animate-spin' testId={testId} />
      </span>
      <p className='es-events-card-body'>{label}</p>
    </div>
  );
}
