import type { Locale, SiteContent } from '@/content';
import { PageLayout } from '@/components/shared/page-layout';
import { Faq } from '@/components/sections/faq';
import { DeferredTestimonials } from '@/components/sections/deferred-testimonials';
import { MyBestAuntieBooking } from '@/components/sections/my-best-auntie-booking';
import { MyBestAuntieDescription } from '@/components/sections/my-best-auntie-description';
import { SproutsSquadCommunity } from '@/components/sections/sprouts-squad-community';

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
      <MyBestAuntieBooking locale={locale} content={content.myBestAuntieBooking} />
      <MyBestAuntieDescription content={content.myBestAuntieDescription} />
      <Faq content={content.faq} />
      <DeferredTestimonials content={content.testimonials} />
      <SproutsSquadCommunity content={content.sproutsSquadCommunity} />
    </PageLayout>
  );
}
