import { PlaceholderPanel } from '@/components/shared/placeholder-panel';
import type { SiteContent } from '@/content';

interface WhoopsProps {
  content: SiteContent['whoops'];
}

export function Whoops({ content }: WhoopsProps) {
  return (
    <PlaceholderPanel>
      <p className='es-type-title leading-none'>
        {content.code}
      </p>
      <h1 className='es-type-title mt-3 leading-tight'>
        {content.title}
      </h1>
      <p className='es-section-body mx-auto mt-3 max-w-[40ch] text-[1rem] leading-relaxed sm:text-[1.1rem]'>
        {content.description}
      </p>
    </PlaceholderPanel>
  );
}
