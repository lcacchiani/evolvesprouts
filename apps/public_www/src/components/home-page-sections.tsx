import type { SiteContent } from '@/content';
import { SproutsSquadCommunity } from '@/components/sections/sprouts-squad-community';
import { Footer } from '@/components/sections/footer';
import { CourseHighlights } from '@/components/sections/course-highlights';
import { HeroBanner } from '@/components/sections/hero-banner';
import { MyBestAuntieOverview } from '@/components/sections/my-best-auntie-overview';
import { Navbar } from '@/components/sections/navbar';
import { Resources } from '@/components/sections/resources';
import { DeferredTestimonials } from '@/components/sections/deferred-testimonials';

interface HomePageSectionsProps {
  content: SiteContent;
}

export function HomePageSections({ content }: HomePageSectionsProps) {
  return (
    <>
      <Navbar content={content.navbar} />
      <main id='main-content' tabIndex={-1} className='min-h-screen'>
        <HeroBanner content={content.hero} />
        <MyBestAuntieOverview content={content.myBestAuntieOverview} />
        <CourseHighlights content={content.courseHighlights} />
        <Resources content={content.resources} />
        <DeferredTestimonials content={content.testimonials} />
        <SproutsSquadCommunity content={content.sproutsSquadCommunity} />
      </main>
      <Footer content={content.footer} />
    </>
  );
}
