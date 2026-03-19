import type { SiteContent } from '@/content';
import { PageLayout } from '@/components/shared/page-layout';
import { TermsAndConditions } from '@/components/sections/terms-and-conditions';

interface TermsAndConditionsPageProps {
  content: SiteContent;
}

export function TermsAndConditionsPage({
  content,
}: TermsAndConditionsPageProps) {
  return (
    <PageLayout
      navbarContent={content.navbar}
      footerContent={content.footer}
    >
      <TermsAndConditions content={content.termsAndConditions} />
    </PageLayout>
  );
}
