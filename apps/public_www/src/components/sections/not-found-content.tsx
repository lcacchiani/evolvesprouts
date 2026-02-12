export function NotFoundContent() {
  return (
    <main
      id='main-content'
      tabIndex={-1}
      className='mx-auto flex min-h-[58vh] w-full max-w-[1465px] items-center px-4 py-16 sm:px-6 lg:px-8'
    >
      <section className='w-full rounded-2xl border border-black/10 bg-white/70 p-8 text-center shadow-sm sm:p-10 lg:p-12'>
        <p className='es-section-heading text-[clamp(7rem,22vw,16rem)] leading-none'>
          404
        </p>
        <h1 className='es-section-heading mt-3 text-[clamp(1.75rem,4.5vw,2.75rem)] leading-tight'>
          Page not found
        </h1>
        <p className='es-section-body mx-auto mt-3 max-w-[40ch] text-[1rem] leading-relaxed sm:text-[1.1rem]'>
          Sorry, the page key you entered is invalid.
        </p>
      </section>
    </main>
  );
}
