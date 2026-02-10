import Image from 'next/image';

import {
  HOMEPAGE_COLORS,
  HOMEPAGE_DESKTOP_DIMENSIONS,
  HOMEPAGE_MOBILE_FULL_IMAGE,
} from './homepage-design-tokens';
import {
  BannerNode,
  CourseModuleNode,
  FooterNode,
  FreeResourcesNode,
  FreeResourcesSecondaryNode,
  NavbarNode,
  RealStoriesNode,
  WhyJoiningOurCoursesNode,
} from './node-sections';

export function HomepageComposition() {
  return (
    <main className='bg-[#FFEFE3] text-slate-900'>
      <div className='mx-auto max-w-[1920px]'>
        <div className='lg:hidden'>
          <Image
            src={HOMEPAGE_MOBILE_FULL_IMAGE.src}
            alt='Evolve Sprouts homepage mobile composition'
            width={HOMEPAGE_MOBILE_FULL_IMAGE.width}
            height={HOMEPAGE_MOBILE_FULL_IMAGE.height}
            className='h-auto w-full'
            priority
            sizes='100vw'
          />
        </div>

        <div
          className='relative hidden w-full overflow-hidden lg:block'
          style={{
            aspectRatio: `${HOMEPAGE_DESKTOP_DIMENSIONS.width} / ${HOMEPAGE_DESKTOP_DIMENSIONS.height}`,
            backgroundColor: HOMEPAGE_COLORS.darkBackground,
          }}
        >
          <NavbarNode />
          <BannerNode />
          <CourseModuleNode />
          <FreeResourcesNode />
          <WhyJoiningOurCoursesNode />
          <FreeResourcesSecondaryNode />
          <RealStoriesNode />
          <FooterNode />
        </div>
      </div>
    </main>
  );
}
