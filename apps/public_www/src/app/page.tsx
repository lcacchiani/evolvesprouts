import { getContent, DEFAULT_LOCALE } from '@/content';
import { Navbar } from '@/components/sections/navbar';
import { HeroBanner } from '@/components/sections/hero-banner';
import { CourseModule } from '@/components/sections/course-module';
import { FreeResources } from '@/components/sections/free-resources';
import { WhyJoining } from '@/components/sections/why-joining';
import { RealStories } from '@/components/sections/real-stories';
import { Footer } from '@/components/sections/footer';

/**
 * Root page — renders the default locale (English) homepage.
 * Locale-specific pages are at /en/, /zh-CN/, /zh-HK/.
 */
export default function RootPage() {
  const content = getContent(DEFAULT_LOCALE);

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
