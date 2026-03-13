import type { SiteContent } from '@/content';
import { PageLayout } from '@/components/shared/page-layout';
import { ContactUsForm } from '@/components/sections/contact-us-form';
import { FreeIntroSession } from '@/components/sections/free-intro-session';
import { ContactUsFaq } from '@/components/sections/contact-us-faq';
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
        content={content.contactUs.form}
        contactConfig={{
          contactEmail: publicSiteConfig.contactEmail,
          whatsappUrl: publicSiteConfig.whatsappUrl,
          instagramUrl: publicSiteConfig.instagramUrl,
          linkedinUrl: publicSiteConfig.linkedinUrl,
        }}
      />
      <ContactUsFaq content={content.contactUs.faq} />
      <FreeIntroSession content={content.freeIntroSession} />
    </PageLayout>
  );
}
