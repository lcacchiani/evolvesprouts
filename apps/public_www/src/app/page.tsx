import { getContent, DEFAULT_LOCALE } from '@/content';

/**
 * Root page — renders the default locale (English) homepage.
 * Locale-specific pages are at /en, /zh-CN, /zh-HK.
 */
export default function RootPage() {
  const content = getContent(DEFAULT_LOCALE);

  return (
    <main className='min-h-screen'>
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
