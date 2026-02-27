import type { SiteContent } from '@/content';
import { PageLayout } from '@/components/shared/page-layout';
import { SproutsSquadCommunity } from '@/components/sections/sprouts-squad-community';
import { CourseHighlights } from '@/components/sections/course-highlights';
import { HeroBanner } from '@/components/sections/hero-banner';
import { IdaIntro } from '@/components/sections/ida-intro';
import { MyBestAuntieOverview } from '@/components/sections/my-best-auntie-overview';
import { FreeResourcesForGentleParenting } from '@/components/sections/free-resources-for-gentle-parenting';
import { DeferredTestimonials } from '@/components/sections/deferred-testimonials';
import {
  buildWhatsappPrefilledHref,
  resolvePublicSiteConfig,
} from '@/lib/site-config';

interface HomePageSectionsProps {
  content: SiteContent;
}

export function HomePageSections({ content }: HomePageSectionsProps) {
  const siteConfig = resolvePublicSiteConfig();
  const baseWhatsappHref = siteConfig.whatsappUrl || content.whatsappContact.href;
  const heroCtaHref = buildWhatsappPrefilledHref(
    baseWhatsappHref,
    content.hero.ctaPrefillMessage,
  ) || baseWhatsappHref;

  return (
    <PageLayout
      navbarContent={content.navbar}
      footerContent={content.footer}
    >
      <HeroBanner content={content.hero} ctaHref={heroCtaHref} />
      <IdaIntro content={content.idaIntro} />
      <MyBestAuntieOverview content={content.myBestAuntieOverview} />
      <CourseHighlights content={content.courseHighlights} />
      <FreeResourcesForGentleParenting content={content.resources} />
      <DeferredTestimonials content={content.testimonials} />
      <SproutsSquadCommunity content={content.sproutsSquadCommunity} />
    </PageLayout>
  );
}
