import { DeferredTestimonialsClient } from '@/components/sections/deferred-testimonials-client';
import type { TestimonialsContent } from '@/content';

interface DeferredTestimonialsProps {
  content: TestimonialsContent;
}

export function DeferredTestimonials({ content }: DeferredTestimonialsProps) {
  return <DeferredTestimonialsClient content={content} />;
}
