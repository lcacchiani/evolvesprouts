import { SITE_COMMON } from '@/content/site-types';

export default function TrainingHomePage() {
  return (
    <main className='flex min-h-screen items-center justify-center p-6'>
      <h1 className='es-type-title text-2xl'>{SITE_COMMON.home.title}</h1>
    </main>
  );
}
