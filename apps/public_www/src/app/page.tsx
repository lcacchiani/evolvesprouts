export default function HomePage() {
  return (
    <main className='mx-auto flex min-h-screen max-w-4xl items-center px-6'>
      <section className='w-full rounded-xl border border-slate-200 bg-white p-8 shadow-sm'>
        <p className='text-xs font-semibold uppercase tracking-[0.25em] text-slate-500'>
          Evolve Sprouts
        </p>
        <h1 className='mt-3 text-3xl font-semibold text-slate-900'>
          Welcome
        </h1>
        <p className='mt-4 text-slate-600'>
          This is the public website home page.
        </p>
      </section>
    </main>
  );
}
