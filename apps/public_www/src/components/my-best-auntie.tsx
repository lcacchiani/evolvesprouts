import type { Locale, SiteContent } from '@/content';
import { Footer } from '@/components/sections/footer';
import { Faq } from '@/components/sections/faq';
import { DeferredTestimonials } from '@/components/sections/deferred-testimonials';
import { MyBestAuntieBooking } from '@/components/sections/my-best-auntie-booking';
import { MyBestAuntieDescription } from '@/components/sections/my-best-auntie-description';
import { Navbar } from '@/components/sections/navbar';
import { SproutsSquadCommunity } from '@/components/sections/sprouts-squad-community';

interface MyBestAuntieProps {
  locale: Locale;
  content: SiteContent;
}

export function MyBestAuntie({ locale, content }: MyBestAuntieProps) {
  return (
    <>
      <Navbar content={content.navbar} />
      <main id='main-content' tabIndex={-1} className='min-h-screen'>
        <MyBestAuntieBooking locale={locale} content={content.myBestAuntieBooking} />
        <MyBestAuntieDescription content={content.myBestAuntieDescription} />
        <Faq content={content.faq} />
        <DeferredTestimonials content={content.testimonials} />
        <SproutsSquadCommunity content={content.sproutsSquadCommunity} />
      </main>
      <Footer content={content.footer} />
    </>
  );
}
