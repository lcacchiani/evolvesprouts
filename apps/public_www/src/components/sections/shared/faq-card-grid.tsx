interface FaqCardGridItem {
  question: string;
  answer: string;
}

interface FaqCardGridProps {
  items: readonly FaqCardGridItem[];
}

export function FaqCardGrid({ items }: FaqCardGridProps) {
  return (
    <ul className='mt-10 grid grid-cols-1 gap-4 sm:gap-5 lg:mt-12 lg:grid-cols-2'>
      {items.map((item) => (
        <li key={item.question}>
          <article className='flex h-full flex-col rounded-2xl border border-black/10 bg-white px-5 py-5 shadow-card sm:px-6 sm:py-6'>
            <h3 className='es-type-subtitle'>{item.question}</h3>
            <p className='mt-3 es-section-body text-base leading-7'>{item.answer}</p>
          </article>
        </li>
      ))}
    </ul>
  );
}
