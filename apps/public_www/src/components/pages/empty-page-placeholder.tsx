import { PlaceholderPanel } from '@/components/shared/placeholder-panel';

interface EmptyPagePlaceholderProps {
  title: string;
}

export function EmptyPagePlaceholder({ title }: EmptyPagePlaceholderProps) {
  return (
    <PlaceholderPanel>
      <h1 className='es-section-heading text-[clamp(1.8rem,5vw,3rem)] leading-[1.15]'>
        {title}
      </h1>
    </PlaceholderPanel>
  );
}
