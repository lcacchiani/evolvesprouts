import type { SiteContent } from '@/content';
import { PageLayout } from '@/components/shared/page-layout';
import { PrivacyPolicy } from '@/components/sections/privacy-policy';

interface PrivacyPolicyPageSectionsProps {
  content: SiteContent;
}

export function PrivacyPolicyPageSections({
  content,
}: PrivacyPolicyPageSectionsProps) {
  return (
    <PageLayout
      navbarContent={content.navbar}
      footerContent={content.footer}
    >
      <PrivacyPolicy content={content.privacyPolicy} />
    </PageLayout>
  );
}
