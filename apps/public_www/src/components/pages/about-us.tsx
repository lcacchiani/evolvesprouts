import type {
  Locale,
  SiteContent,
} from '@/content';
import { PageLayout } from '@/components/shared/page-layout';
import { DeferredTestimonials } from '@/components/sections/deferred-testimonials';
import { AboutUsHero } from '@/components/sections/ida';
import { AboutUsMyHistory } from '@/components/sections/my-history';
import { AboutUsMyJourney } from '@/components/sections/my-journey';
import { SproutsSquadCommunity } from '@/components/sections/sprouts-squad-community';
import { AboutUsWhyUs } from '@/components/sections/why-us';

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
      <AboutUsHero content={content.aboutUs.hero} />
      <AboutUsMyHistory content={content.aboutUs.myHistory} />
      <AboutUsMyJourney content={content.aboutUs.myJourney} />
      <AboutUsWhyUs locale={locale} content={content.aboutUs.whyUs} />
      <DeferredTestimonials
        content={content.testimonials}
        commonAccessibility={content.common.accessibility}
      />
      <SproutsSquadCommunity content={content.sproutsSquadCommunity} />
    </PageLayout>
  );
}
