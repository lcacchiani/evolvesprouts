import { PageLayout } from '@/components/shared/page-layout';
import { FreeGuidesAndResourcesFaq } from '@/components/sections/free-guides-and-resources-faq';
import { FreeGuidesAndResourcesHero } from '@/components/sections/free-guides-and-resources-hero';
import { FreeGuidesAndResourcesLibrary } from '@/components/sections/free-guides-and-resources-library';
import { FreeResourcesForGentleParenting } from '@/components/sections/free-resources-for-gentle-parenting';
import { SproutsSquadCommunity } from '@/components/sections/sprouts-squad-community';
import type { Locale, SiteContent } from '@/content';

interface FreeGuidesAndResourcesPageProps {
  content: SiteContent;
  locale: Locale;
}

export function FreeGuidesAndResourcesPage({
  content,
  locale,
}: FreeGuidesAndResourcesPageProps) {
  return (
    <PageLayout
      navbarContent={content.navbar}
      footerContent={content.footer}
    >
      <FreeGuidesAndResourcesHero content={content.freeGuidesAndResources.hero} />
      <FreeResourcesForGentleParenting content={content.resources} locale={locale} />
      <FreeGuidesAndResourcesLibrary
        content={content.freeGuidesAndResources.library}
        mediaFormContent={content.resources}
        locale={locale}
      />
      <FreeGuidesAndResourcesFaq content={content.freeGuidesAndResources.faq} />
      <SproutsSquadCommunity
        content={content.sproutsSquadCommunity}
        commonCaptchaContent={content.common.captcha}
        locale={locale}
      />
    </PageLayout>
  );
}
