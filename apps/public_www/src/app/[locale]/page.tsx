import {
  SUPPORTED_LOCALES,
  DEFAULT_LOCALE,
  getContent,
  isValidLocale,
} from '@/content';

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
    <main className='min-h-screen'>
      {/* Page sections — import and compose here.
          After running figma:scaffold, add section components:

          import { Navbar } from '@/components/sections/navbar';
          import { HeroBanner } from '@/components/sections/hero-banner';

          <Navbar content={content.navbar} />
          <HeroBanner content={content.hero} />
      */}
      <div className='flex items-center justify-center py-24'>
        <div className='text-center'>
          <h1 className='text-4xl font-bold'>{content.hero.headline}</h1>
          <p className='mt-4 text-lg text-slate-600'>
            {content.hero.subheadline}
          </p>
        </div>
      </div>
    </main>
  );
}
