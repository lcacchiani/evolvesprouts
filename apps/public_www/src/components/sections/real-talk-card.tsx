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
      className={`relative flex min-h-[320px] overflow-hidden rounded-card p-5 sm:min-h-[345px] sm:p-7 lg:min-h-[457px] lg:p-8 ${toneClassMap[tone]}`}
    >
      <div className='relative z-10 mt-auto'>
        <h3 className='max-w-[12ch] text-balance es-real-talk-title'>{title}</h3>
      </div>
    </div>
  );
}
