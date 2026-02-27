import type { SiteContent } from '@/content';
import { PageLayout } from '@/components/shared/page-layout';
import { TermsAndConditions } from '@/components/sections/terms-and-conditions';

interface TermsAndConditionsPageSectionsProps {
  content: SiteContent;
}

export function TermsAndConditionsPageSections({
  content,
}: TermsAndConditionsPageSectionsProps) {
  return (
    <PageLayout
      navbarContent={content.navbar}
      footerContent={content.footer}
    >
      <TermsAndConditions content={content.termsAndConditions} />
    </PageLayout>
  );
}
