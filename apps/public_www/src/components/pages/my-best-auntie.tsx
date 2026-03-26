import type { Locale, SiteContent } from '@/content';
import { buildWhatsappPrefilledHref, resolvePublicSiteConfig } from '@/lib/site-config';
import { PageLayout } from '@/components/shared/page-layout';
import { Faq } from '@/components/sections/faq';
import { Testimonials } from '@/components/sections/testimonials';
import { MyBestAuntieHero } from '@/components/sections/my-best-auntie/my-best-auntie-hero';
import { MyBestAuntieBooking } from '@/components/sections/my-best-auntie/my-best-auntie-booking';
import { MyBestAuntieDescription } from '@/components/sections/my-best-auntie/my-best-auntie-description';
import { MyBestAuntieOutline } from '@/components/sections/my-best-auntie/my-best-auntie-outline';
import { FreeIntroSession } from '@/components/sections/free-intro-session';

interface MyBestAuntiePageProps {
  locale: Locale;
  content: SiteContent;
}

export function MyBestAuntiePage({ locale, content }: MyBestAuntiePageProps) {
  const publicSiteConfig = resolvePublicSiteConfig();
  const privateProgrammeWhatsappHref = buildWhatsappPrefilledHref(
    content.freeIntroSession.ctaHref,
    content.myBestAuntie.booking.privateProgrammePrefillMessage,
    content.freeIntroSession.phoneNumber,
  ) || content.freeIntroSession.ctaHref;

  return (
    <PageLayout
      navbarContent={content.navbar}
      footerContent={content.footer}
    >
      <MyBestAuntieHero content={content.myBestAuntie.hero} />
      <MyBestAuntieDescription
        content={content.myBestAuntie.description}
        commonAccessibility={content.common.accessibility}
      />
      <MyBestAuntieOutline
        content={content.myBestAuntie.outline}
        commonAccessibility={content.common.accessibility}
      />
      <Testimonials
        content={content.testimonials}
        commonAccessibility={content.common.accessibility}
      />
      <MyBestAuntieBooking
        locale={locale}
        content={content.myBestAuntie.booking}
        modalContent={content.myBestAuntie.modal}
        bookingModalContent={content.bookingModal}
        commonAccessibility={content.common.accessibility}
        thankYouWhatsappHref={publicSiteConfig.whatsappUrl}
        thankYouWhatsappCtaLabel={content.contactUs.form.contactMethodLinks.whatsapp}
        privateProgrammeWhatsappHref={privateProgrammeWhatsappHref}
      />
      <Faq content={content.faq} />
      <FreeIntroSession content={content.freeIntroSession} />
    </PageLayout>
  );
}
