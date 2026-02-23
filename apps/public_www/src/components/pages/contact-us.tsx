import type { SiteContent } from '@/content';
import { PageLayout } from '@/components/shared/page-layout';
import { ContactUsForm } from '@/components/sections/contact-us-form';
import { ReachOut } from '@/components/sections/reach-out';
import { SproutsSquadCommunity } from '@/components/sections/sprouts-squad-community';

interface ContactUsPageSectionsProps {
  content: SiteContent;
}

export function ContactUsPageSections({ content }: ContactUsPageSectionsProps) {
  return (
    <PageLayout
      navbarContent={content.navbar}
      footerContent={content.footer}
    >
      <ContactUsForm content={content.contactUs.contactUsForm} />
      <ReachOut content={content.contactUs.reachOut} />
      <SproutsSquadCommunity content={content.sproutsSquadCommunity} />
    </PageLayout>
  );
}
