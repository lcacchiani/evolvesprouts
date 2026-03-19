import type { ContactUsContent } from '@/content';
import { renderQuotedDescriptionText } from '@/components/sections/shared/render-highlighted-text';

interface ContactFormSuccessProps {
  title: ContactUsContent['form']['successTitle'];
  description: ContactUsContent['form']['successDescription'];
}

export function ContactFormSuccess({ title, description }: ContactFormSuccessProps) {
  return (
    <div className='relative z-10 rounded-2xl es-bg-surface-muted px-5 py-6 text-center'>
      <h3 className='text-2xl font-semibold es-text-heading'>{title}</h3>
      <p className='mt-3 text-base leading-7 text-[color:var(--site-primary-text)]'>
        {renderQuotedDescriptionText(description)}
      </p>
    </div>
  );
}
