import type { Locale, SiteContent } from '@/content';
import { PageLayout } from '@/components/shared/page-layout';
import { Faq } from '@/components/sections/faq';
import { DeferredTestimonials } from '@/components/sections/deferred-testimonials';
import { MyBestAuntieHero } from '@/components/sections/my-best-auntie/my-best-auntie-hero';
import { MyBestAuntieBooking } from '@/components/sections/my-best-auntie/my-best-auntie-booking';
import { MyBestAuntieDescription } from '@/components/sections/my-best-auntie/my-best-auntie-description';
import { MyBestAuntieOutline } from '@/components/sections/my-best-auntie/my-best-auntie-outline';
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
      <MyBestAuntieHero content={content.myBestAuntieHero} />
      <MyBestAuntieDescription content={content.myBestAuntieDescription} />
      <MyBestAuntieOutline content={content.myBestAuntieOutline} />
      <DeferredTestimonials content={content.testimonials} />
      <MyBestAuntieBooking locale={locale} content={content.myBestAuntieBooking} />
      <Faq content={content.faq} />
      <SproutsSquadCommunity content={content.sproutsSquadCommunity} />
    </PageLayout>
  );
}
