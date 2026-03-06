import type { Locale, SiteContent } from '@/content';
import { PageLayout } from '@/components/shared/page-layout';
import { FreeIntroSession } from '@/components/sections/free-intro-session';
import { CourseHighlights } from '@/components/sections/course-highlights';
import { RealTalk } from '@/components/sections/real-talk';
import { HeroBanner } from '@/components/sections/hero-banner';
import { IdaIntro } from '@/components/sections/ida-intro';
import { MyBestAuntieOverview } from '@/components/sections/my-best-auntie-overview';
import { FreeResourcesForGentleParenting } from '@/components/sections/free-resources-for-gentle-parenting';
import { DeferredTestimonials } from '@/components/sections/deferred-testimonials';
import { localizeHref } from '@/lib/locale-routing';
import { ROUTES } from '@/lib/routes';
import {
  buildWhatsappPrefilledHref,
  resolvePublicSiteConfig,
} from '@/lib/site-config';

interface HomePageSectionsProps {
  locale: Locale;
  content: SiteContent;
}

function resolveNavbarBookNowHref(bookNow: SiteContent['navbar']['bookNow']): string | undefined {
  if (
    'href' in bookNow
    && typeof bookNow.href === 'string'
    && bookNow.href.trim() !== ''
  ) {
    return bookNow.href;
  }

  return undefined;
}

function resolveNavbarBookNowPrefillMessage(
  bookNow: SiteContent['navbar']['bookNow'],
): string | undefined {
  if (
    'prefillMessage' in bookNow
    && typeof bookNow.prefillMessage === 'string'
    && bookNow.prefillMessage.trim() !== ''
  ) {
    return bookNow.prefillMessage;
  }

  return undefined;
}

export function HomePageSections({ locale, content }: HomePageSectionsProps) {
  const siteConfig = resolvePublicSiteConfig();
  const heroCtaHref = localizeHref(
    content.hero.ctaHref || ROUTES.servicesMyBestAuntieTrainingCourse,
    locale,
  );
  const baseNavbarCtaHref = siteConfig.whatsappUrl
    || resolveNavbarBookNowHref(content.navbar.bookNow)
    || content.whatsappContact.href
    || ROUTES.servicesMyBestAuntieTrainingCourse;
  const navbarCtaHref = buildWhatsappPrefilledHref(
    baseNavbarCtaHref,
    resolveNavbarBookNowPrefillMessage(content.navbar.bookNow),
    siteConfig.businessPhoneNumber,
  ) || baseNavbarCtaHref;
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
      <RealTalk content={content.realTalk} />
      <IdaIntro content={content.idaIntro} />
      <MyBestAuntieOverview content={content.myBestAuntieOverview} />
      <CourseHighlights content={content.courseHighlights} />
      <FreeResourcesForGentleParenting content={content.resources} />
      <DeferredTestimonials content={content.testimonials} />
      <FreeIntroSession content={content.freeIntroSession} ctaHref={navbarCtaHref} />
    </PageLayout>
  );
}
