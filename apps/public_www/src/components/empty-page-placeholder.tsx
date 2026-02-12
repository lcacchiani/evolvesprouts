interface EmptyPagePlaceholderProps {
  title: string;
}

export function EmptyPagePlaceholder({ title }: EmptyPagePlaceholderProps) {
  return (
    <main
      id='main-content'
      tabIndex={-1}
      className='mx-auto flex min-h-[52vh] w-full max-w-[1465px] items-center px-4 py-16 sm:px-6 lg:px-8'
    >
      <section className='w-full rounded-2xl border border-black/10 bg-white/70 p-8 text-center shadow-sm sm:p-10 lg:p-12'>
        <h1 className='es-section-heading text-[clamp(1.8rem,5vw,3rem)] leading-[1.15]'>
          {title}
        </h1>
      </section>
    </main>
  );
}
