import type { Locale, SiteContent } from '@/content';
import { PageLayout } from '@/components/shared/page-layout';
import { SproutsSquadCommunity } from '@/components/sections/sprouts-squad-community';
import { CourseHighlights } from '@/components/sections/course-highlights';
import { HeroBanner } from '@/components/sections/hero-banner';
import { IdaIntro } from '@/components/sections/ida-intro';
import { MyBestAuntieOverview } from '@/components/sections/my-best-auntie-overview';
import { FreeResourcesForGentleParenting } from '@/components/sections/free-resources-for-gentle-parenting';
import { DeferredTestimonials } from '@/components/sections/deferred-testimonials';
import { localizeHref } from '@/lib/locale-routing';
import { ROUTES } from '@/lib/routes';
import { resolvePublicSiteConfig } from '@/lib/site-config';

interface HomePageSectionsProps {
  locale: Locale;
  content: SiteContent;
}

export function HomePageSections({ locale, content }: HomePageSectionsProps) {
  const siteConfig = resolvePublicSiteConfig();
  const heroCtaHref = localizeHref(
    content.hero.ctaHref || ROUTES.servicesMyBestAuntieTrainingCourse,
    locale,
  );
  const navbarCtaHref = siteConfig.whatsappUrl || content.navbar.bookNow.href;
  const homepageNavbarContent = {
    ...content.navbar,
    bookNow: {
      ...content.navbar.bookNow,
      href: navbarCtaHref,
    },
  };

  return (
    <PageLayout
      navbarContent={homepageNavbarContent}
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
