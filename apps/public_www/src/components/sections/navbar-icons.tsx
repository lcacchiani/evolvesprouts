import { TEXT_HEADING_STRONG } from '@/lib/design-tokens';

interface ChevronIconProps {
  isOpen?: boolean;
}

export function LanguageChevronIcon({ isOpen = false }: ChevronIconProps) {
  return (
    <svg
      aria-hidden='true'
      viewBox='0 0 20 20'
      className={`h-5 w-5 transition-transform ${isOpen ? 'rotate-180' : ''}`}
      fill='none'
      xmlns='http://www.w3.org/2000/svg'
    >
      <path
        d='M5 8L10 13L15 8'
        stroke={TEXT_HEADING_STRONG}
        strokeWidth='2'
        strokeLinecap='round'
        strokeLinejoin='round'
      />
    </svg>
  );
}

export function MobileChevronIcon({ isExpanded }: { isExpanded: boolean }) {
  return (
    <svg
      aria-hidden='true'
      viewBox='0 0 16 16'
      className={`h-4 w-4 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
      fill='none'
      xmlns='http://www.w3.org/2000/svg'
    >
      <path
        d='M4 6L8 10L12 6'
        stroke='currentColor'
        strokeWidth='1.8'
        strokeLinecap='round'
        strokeLinejoin='round'
      />
    </svg>
  );
}

export function HamburgerIcon() {
  return (
    <svg
      aria-hidden='true'
      viewBox='0 0 448 512'
      className='h-4 w-4'
      fill='currentColor'
      xmlns='http://www.w3.org/2000/svg'
    >
      <path
        d='M0 96C0 78.3 14.3 64 32 64H416c17.7 0 32 14.3 32 32s-14.3 32-32 32H32C14.3 128 0 113.7 0 96zM0 256c0-17.7 14.3-32 32-32H416c17.7 0 32 14.3 32 32s-14.3 32-32 32H32c-17.7 0-32-14.3-32-32zM448 416c0 17.7-14.3 32-32 32H32c-17.7 0-32-14.3-32-32s14.3-32 32-32H416c17.7 0 32 14.3 32 32z'
      />
    </svg>
  );
}

export function CloseIcon() {
  return (
    <svg
      aria-hidden='true'
      viewBox='0 0 16 16'
      className='h-[18px] w-[18px]'
      fill='currentColor'
      xmlns='http://www.w3.org/2000/svg'
    >
      <path
        d='M.293.293a1 1 0 011.414 0L8 6.586 14.293.293a1 1 0 111.414 1.414L9.414 8l6.293 6.293a1 1 0 01-1.414 1.414L8 9.414l-6.293 6.293a1 1 0 01-1.414-1.414L6.586 8 .293 1.707a1 1 0 010-1.414z'
      />
    </svg>
  );
}

export function CalendarIcon() {
  return (
    <svg
      aria-hidden='true'
      viewBox='0 0 16 16'
      className='h-3.5 w-3.5'
      fill='none'
      xmlns='http://www.w3.org/2000/svg'
    >
      <rect x='2' y='3' width='12' height='11' rx='2' stroke='currentColor' />
      <path d='M2 6H14' stroke='currentColor' />
      <path d='M5 1.5V4.5' stroke='currentColor' strokeLinecap='round' />
      <path d='M11 1.5V4.5' stroke='currentColor' strokeLinecap='round' />
    </svg>
  );
}

export function ClockIcon() {
  return (
    <svg
      aria-hidden='true'
      viewBox='0 0 16 16'
      className='h-3.5 w-3.5'
      fill='none'
      xmlns='http://www.w3.org/2000/svg'
    >
      <circle cx='8' cy='8' r='6' stroke='currentColor' />
      <path d='M8 4.8V8L10.3 9.6' stroke='currentColor' strokeLinecap='round' />
    </svg>
  );
}

export function LocationIcon() {
  return (
    <svg
      aria-hidden='true'
      viewBox='0 0 16 16'
      className='h-3.5 w-3.5'
      fill='none'
      xmlns='http://www.w3.org/2000/svg'
    >
      <path
        d='M8 14C8 14 12 10.4 12 6.9C12 4.7 10.2 3 8 3C5.8 3 4 4.7 4 6.9C4 10.4 8 14 8 14Z'
        stroke='currentColor'
      />
      <circle cx='8' cy='6.8' r='1.5' stroke='currentColor' />
    </svg>
  );
}
