import type { SiteContent } from '@/content';
import { PageLayout } from '@/components/shared/page-layout';
import { Faq } from '@/components/sections/faq';
import { Ida } from '@/components/sections/ida';
import { MyHistory } from '@/components/sections/my-history';
import { MyJourney } from '@/components/sections/my-journey';
import { SproutsSquadCommunity } from '@/components/sections/sprouts-squad-community';
import { WhyUs } from '@/components/sections/why-us';

interface AboutUsProps {
  content: SiteContent;
}

export function AboutUs({ content }: AboutUsProps) {
  return (
    <PageLayout
      navbarContent={content.navbar}
      footerContent={content.footer}
    >
      <Ida content={content.ida} />
      <MyHistory content={content.myHistory} />
      <MyJourney content={content.myJourney} />
      <WhyUs content={content.whyUs} />
      <Faq content={content.faq} />
      <SproutsSquadCommunity content={content.sproutsSquadCommunity} />
    </PageLayout>
  );
}
