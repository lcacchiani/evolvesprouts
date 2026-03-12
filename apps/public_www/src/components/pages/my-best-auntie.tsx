import type { Locale, SiteContent } from '@/content';
import { PageLayout } from '@/components/shared/page-layout';
import { Faq } from '@/components/sections/faq';
import { DeferredTestimonials } from '@/components/sections/deferred-testimonials';
import { MyBestAuntieHero } from '@/components/sections/my-best-auntie/my-best-auntie-hero';
import { MyBestAuntieBooking } from '@/components/sections/my-best-auntie/my-best-auntie-booking';
import { MyBestAuntieDescription } from '@/components/sections/my-best-auntie/my-best-auntie-description';
import { MyBestAuntieOutline } from '@/components/sections/my-best-auntie/my-best-auntie-outline';
import { FreeIntroSession } from '@/components/sections/free-intro-session';

interface MyBestAuntieProps {
  locale: Locale;
  content: SiteContent;
}

export function MyBestAuntie({ locale, content }: MyBestAuntieProps) {
  return (
    <PageLayout
      navbarContent={content.navbar}
      footerContent={content.footer}
    >
      <MyBestAuntieHero content={content.myBestAuntieHero} />
      <MyBestAuntieDescription
        content={content.myBestAuntieDescription}
        commonAccessibility={content.common.accessibility}
      />
      <MyBestAuntieOutline
        content={content.myBestAuntieOutline}
        commonAccessibility={content.common.accessibility}
      />
      <DeferredTestimonials
        content={content.testimonials}
        commonAccessibility={content.common.accessibility}
      />
      <MyBestAuntieBooking
        locale={locale}
        content={content.myBestAuntieBooking}
        commonAccessibility={content.common.accessibility}
      />
      <Faq content={content.faq} />
      <FreeIntroSession content={content.freeIntroSession} />
    </PageLayout>
  );
}
