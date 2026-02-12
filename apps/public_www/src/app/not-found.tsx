import { Footer } from '@/components/sections/footer';
import { Navbar } from '@/components/sections/navbar';
import { Whoops } from '@/components/sections/whoops';
import { DEFAULT_LOCALE, getContent } from '@/content';

const content = getContent(DEFAULT_LOCALE);

export default function NotFoundPage() {
  return (
    <>
      <Navbar content={content.navbar} />
      <main
        id='main-content'
        tabIndex={-1}
        className='mx-auto flex min-h-[58vh] w-full max-w-[1465px] items-center px-4 py-16 sm:px-6 lg:px-8'
      >
        <Whoops />
      </main>
      <Footer content={content.footer} />
    </>
  );
}
