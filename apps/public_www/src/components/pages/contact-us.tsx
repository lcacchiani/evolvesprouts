import type { SiteContent } from '@/content';
import { PageLayout } from '@/components/shared/page-layout';
import { ContactUsForm } from '@/components/sections/contact-us-form';
import { ReachOut } from '@/components/sections/reach-out';
import { SproutsSquadCommunity } from '@/components/sections/sprouts-squad-community';
import { resolvePublicSiteConfig } from '@/lib/site-config';

interface ContactUsPageSectionsProps {
  content: SiteContent;
}

export function ContactUsPageSections({ content }: ContactUsPageSectionsProps) {
  const publicSiteConfig = resolvePublicSiteConfig();

  return (
    <PageLayout
      navbarContent={content.navbar}
      footerContent={content.footer}
    >
      <ContactUsForm
        content={content.contactUs.contactUsForm}
        contactConfig={{
          contactEmail: publicSiteConfig.contactEmail,
          whatsappUrl: publicSiteConfig.whatsappUrl,
          instagramUrl: publicSiteConfig.instagramUrl,
          linkedinUrl: publicSiteConfig.linkedinUrl,
        }}
      />
      <ReachOut content={content.contactUs.reachOut} />
      <SproutsSquadCommunity content={content.sproutsSquadCommunity} />
    </PageLayout>
  );
}
