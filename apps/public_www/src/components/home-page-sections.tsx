import type { SiteContent } from '@/content';
import { SproutsSquadCommunity } from '@/components/sections/sprouts-squad-community';
import { Footer } from '@/components/sections/footer';
import { CourseHighlights } from '@/components/sections/course-highlights';
import { CourseModule } from '@/components/sections/course-module';
import { HeroBanner } from '@/components/sections/hero-banner';
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
        <CourseModule content={content.courseModule} />
        <CourseHighlights content={content.courseHighlights} />
        <Resources content={content.resources} />
        <Testimonials content={content.testimonials} />
      </main>
      <SproutsSquadCommunity content={content.footer} />
      <Footer content={content.footer} />
    </>
  );
}
