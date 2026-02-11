import {
  SUPPORTED_LOCALES,
  DEFAULT_LOCALE,
  getContent,
  isValidLocale,
} from '@/content';
import { Navbar } from '@/components/sections/navbar';
import { HeroBanner } from '@/components/sections/hero-banner';
import { CourseModule } from '@/components/sections/course-module';
import { FreeResources } from '@/components/sections/free-resources';
import { WhyJoining } from '@/components/sections/why-joining';
import { RealStories } from '@/components/sections/real-stories';
import { Footer } from '@/components/sections/footer';

export function generateStaticParams() {
  return SUPPORTED_LOCALES.map((locale) => ({ locale }));
}

export default async function HomePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const validLocale = isValidLocale(locale) ? locale : DEFAULT_LOCALE;
  const content = getContent(validLocale);

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
