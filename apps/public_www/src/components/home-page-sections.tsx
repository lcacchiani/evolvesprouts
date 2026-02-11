import type { SiteContent } from '@/content';
import { Footer } from '@/components/sections/footer';
import { CourseModule } from '@/components/sections/course-module';
import { FreeResources } from '@/components/sections/free-resources';
import { HeroBanner } from '@/components/sections/hero-banner';
import { Navbar } from '@/components/sections/navbar';
import { RealStories } from '@/components/sections/real-stories';
import { WhyJoining } from '@/components/sections/why-joining';

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
        <FreeResources content={content.freeResources} />
        <WhyJoining content={content.whyJoining} />
        <RealStories content={content.realStories} />
      </main>
      <Footer content={content.footer} />
    </>
  );
}
