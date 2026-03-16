import type { Locale, SiteContent } from '@/content';
import { LinksHub } from '@/components/sections/links-hub';
import { localizeHref } from '@/lib/locale-routing';
import { ROUTES } from '@/lib/routes';
import {
  buildWhatsappPrefilledHref,
  resolvePublicSiteConfig,
} from '@/lib/site-config';

interface LinksPageSectionsProps {
  locale: Locale;
  content: SiteContent;
}

export function LinksPageSections({ locale, content }: LinksPageSectionsProps) {
  const publicSiteConfig = resolvePublicSiteConfig();
  const whatsappHref = buildWhatsappPrefilledHref(
    publicSiteConfig.whatsappUrl,
    content.whatsappContact.href ? undefined : undefined,
    publicSiteConfig.businessPhoneNumber,
  ) || publicSiteConfig.whatsappUrl || '';

  return (
    <main id='main-content' tabIndex={-1}>
      <LinksHub
        content={content.links.hub}
        localizedCourseHref={localizeHref(ROUTES.servicesMyBestAuntieTrainingCourse, locale)}
        localizedContactHref={localizeHref(ROUTES.contact, locale)}
        localizedEventsHref={localizeHref(ROUTES.events, locale)}
        whatsappHref={whatsappHref}
      />
    </main>
  );
}
