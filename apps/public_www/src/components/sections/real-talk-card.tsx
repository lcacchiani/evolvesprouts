export type RealTalkCardTone = 'green' | 'blue';

interface RealTalkCardProps {
  title: string;
  tone: RealTalkCardTone;
}

export function RealTalkCard({ title, tone }: RealTalkCardProps) {
  const toneClassMap: Record<RealTalkCardTone, string> = {
    green: 'es-real-talk-card--green',
    blue: 'es-real-talk-card--blue',
  };

  return (
    <div
      className={`relative flex h-full min-h-[108px] flex-col overflow-hidden rounded-card p-4 sm:min-h-[115px] sm:p-5 lg:min-h-[152px] lg:p-6 ${toneClassMap[tone]}`}
    >
      <span
        aria-hidden='true'
        className='es-testimonial-quote-icon relative z-10 h-6 w-6 sm:h-7 sm:w-7'
      />
      <div className='relative z-10 mt-2 sm:mt-2.5'>
        <h3 className='text-balance es-real-talk-title'>{title}</h3>
      </div>
    </div>
  );
}
