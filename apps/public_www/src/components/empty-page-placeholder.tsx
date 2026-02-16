interface EmptyPagePlaceholderProps {
  title: string;
}

export function EmptyPagePlaceholder({ title }: EmptyPagePlaceholderProps) {
  return (
    <section className='w-full rounded-2xl border border-black/10 bg-white/70 p-8 text-center shadow-sm sm:p-10 lg:p-12'>
      <h1 className='es-section-heading text-[clamp(1.8rem,5vw,3rem)] leading-[1.15]'>
        {title}
      </h1>
    </section>
  );
}
