import type {
  Locale,
  SiteContent,
} from '@/content';
import { PageLayout } from '@/components/shared/page-layout';
import { DeferredTestimonials } from '@/components/sections/deferred-testimonials';
import { Ida } from '@/components/sections/ida';
import { MyHistory } from '@/components/sections/my-history';
import { MyJourney } from '@/components/sections/my-journey';
import { SproutsSquadCommunity } from '@/components/sections/sprouts-squad-community';
import { WhyUs } from '@/components/sections/why-us';

interface AboutUsProps {
  locale: Locale;
  content: SiteContent;
}

export function AboutUs({ locale, content }: AboutUsProps) {
  return (
    <PageLayout
      navbarContent={content.navbar}
      footerContent={content.footer}
    >
      <Ida content={content.aboutUs.hero} />
      <MyHistory content={content.aboutUs.myHistory} />
      <MyJourney content={content.aboutUs.myJourney} />
      <WhyUs locale={locale} content={content.aboutUs.whyUs} />
      <DeferredTestimonials
        content={content.testimonials}
        commonAccessibility={content.common.accessibility}
      />
      <SproutsSquadCommunity content={content.sproutsSquadCommunity} />
    </PageLayout>
  );
}
