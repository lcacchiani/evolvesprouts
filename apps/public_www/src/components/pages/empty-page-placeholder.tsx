import { PlaceholderPanel } from '@/components/shared/placeholder-panel';

interface EmptyPagePlaceholderProps {
  title: string;
}

export function EmptyPagePlaceholder({ title }: EmptyPagePlaceholderProps) {
  return (
    <PlaceholderPanel>
      <h1 className='es-type-title leading-[1.15]'>
        {title}
      </h1>
    </PlaceholderPanel>
  );
}
