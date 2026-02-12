import type { SiteContent } from '@/content';
import { SproutsSquadCommunity } from '@/components/sections/sprouts-squad-community';
import { Footer } from '@/components/sections/footer';
import { CourseHighlights } from '@/components/sections/course-highlights';
import { HeroBanner } from '@/components/sections/hero-banner';
import { MyBestAuntieOverview } from '@/components/sections/my-best-auntie-overview';
import { Navbar } from '@/components/sections/navbar';
import { Resources } from '@/components/sections/resources';
import { Testimonials } from '@/components/sections/testimonials';

interface HomePageSectionsProps {
  content: SiteContent;
}

export function HomePageSections({ content }: HomePageSectionsProps) {
  return (
    <>
      <Navbar content={content.navbar} />
      <main className='min-h-screen'>
        <HeroBanner content={content.hero} />
        <MyBestAuntieOverview content={content.myBestAuntieOverview} />
        <CourseHighlights content={content.courseHighlights} />
        <Resources content={content.resources} />
        <Testimonials content={content.testimonials} />
        <SproutsSquadCommunity content={content.sproutsSquadCommunity} />
      </main>
      <Footer content={content.footer} />
    </>
  );
}
