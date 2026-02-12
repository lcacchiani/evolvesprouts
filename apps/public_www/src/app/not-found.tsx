import { Footer } from '@/components/sections/footer';
import { Navbar } from '@/components/sections/navbar';
import { NotFoundSection } from '@/components/sections/not-found-section';
import { DEFAULT_LOCALE, getContent } from '@/content';

const content = getContent(DEFAULT_LOCALE);

export default function NotFoundPage() {
  return (
    <>
      <Navbar content={content.navbar} />
      <NotFoundSection />
      <Footer content={content.footer} />
    </>
  );
}
