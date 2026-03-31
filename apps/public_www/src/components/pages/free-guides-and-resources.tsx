import { PageLayout } from '@/components/shared/page-layout';
import { FreeGuidesAndResourcesFaq } from '@/components/sections/free-guides-and-resources-faq';
import { FreeGuidesAndResourcesHero } from '@/components/sections/free-guides-and-resources-hero';
import { FreeGuidesAndResourcesLibrary } from '@/components/sections/free-guides-and-resources-library';
import { FreeResourcesForGentleParenting } from '@/components/sections/free-resources-for-gentle-parenting';
import { SproutsSquadCommunity } from '@/components/sections/sprouts-squad-community';
import type { SiteContent } from '@/content';

interface FreeGuidesAndResourcesPageProps {
  content: SiteContent;
}

export function FreeGuidesAndResourcesPage({
  content,
}: FreeGuidesAndResourcesPageProps) {
  return (
    <PageLayout
      navbarContent={content.navbar}
      footerContent={content.footer}
    >
      <FreeGuidesAndResourcesHero content={content.freeGuidesAndResources.hero} />
      <FreeResourcesForGentleParenting content={content.resources} />
      <FreeGuidesAndResourcesLibrary
        content={content.freeGuidesAndResources.library}
      />
      <SproutsSquadCommunity
        content={content.sproutsSquadCommunity}
        commonCaptchaContent={content.common.captcha}
      />
      <FreeGuidesAndResourcesFaq content={content.freeGuidesAndResources.faq} />
    </PageLayout>
  );
}
