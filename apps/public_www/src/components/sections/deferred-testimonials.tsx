import { DeferredTestimonialsClient } from '@/components/sections/deferred-testimonials-client';
import type {
  CommonAccessibilityContent,
  TestimonialsContent,
} from '@/content';

interface DeferredTestimonialsProps {
  content: TestimonialsContent;
  commonAccessibility?: CommonAccessibilityContent;
}

export function DeferredTestimonials({
  content,
  commonAccessibility,
}: DeferredTestimonialsProps) {
  return (
    <DeferredTestimonialsClient
      content={content}
      commonAccessibility={commonAccessibility}
    />
  );
}
