import { Footer } from '@/components/sections/footer';
import { Navbar } from '@/components/sections/navbar';
import { NotFoundContent } from '@/components/sections/not-found-content';
import { DEFAULT_LOCALE, getContent } from '@/content';

const content = getContent(DEFAULT_LOCALE);

export default function NotFoundPage() {
  return (
    <>
      <Navbar content={content.navbar} />
      <NotFoundContent />
      <Footer content={content.footer} />
    </>
  );
}
