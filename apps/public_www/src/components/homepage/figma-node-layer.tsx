import Image from 'next/image';

import {
  HOMEPAGE_DESKTOP_DIMENSIONS,
  type HomepageNodeFrame,
} from './homepage-design-tokens';

interface FigmaNodeLayerProps {
  frame: HomepageNodeFrame;
  priority?: boolean;
}

interface FigmaNodeStackSectionProps {
  frame: HomepageNodeFrame;
  priority?: boolean;
  sectionClassName?: string;
}

function toPercent(value: number, total: number): string {
  return `${(value / total) * 100}%`;
}

export function FigmaNodeLayer({
  frame,
  priority = false,
}: FigmaNodeLayerProps) {
  return (
    <section
      aria-label={`${frame.nodeName} (${frame.nodeId})`}
      data-node-id={frame.nodeId}
      data-node-name={frame.nodeName}
      className='absolute'
      style={{
        left: toPercent(frame.x, HOMEPAGE_DESKTOP_DIMENSIONS.width),
        top: toPercent(frame.y, HOMEPAGE_DESKTOP_DIMENSIONS.height),
        width: toPercent(frame.width, HOMEPAGE_DESKTOP_DIMENSIONS.width),
      }}
    >
      <Image
        src={frame.imageSrc}
        alt={`${frame.nodeName} section`}
        width={frame.imageWidth}
        height={frame.imageHeight}
        className='h-auto w-full'
        sizes='100vw'
        priority={priority}
      />
    </section>
  );
}

export function FigmaNodeStackSection({
  frame,
  priority = false,
  sectionClassName = '',
}: FigmaNodeStackSectionProps) {
  return (
    <section
      aria-label={`${frame.nodeName} (${frame.nodeId})`}
      data-node-id={frame.nodeId}
      data-node-name={frame.nodeName}
      className={sectionClassName}
    >
      <Image
        src={frame.imageSrc}
        alt={`${frame.nodeName} section`}
        width={frame.imageWidth}
        height={frame.imageHeight}
        className='h-auto w-full'
        sizes='100vw'
        priority={priority}
      />
    </section>
  );
}
