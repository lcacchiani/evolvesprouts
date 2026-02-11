import {
  HOMEPAGE_COLORS,
  HOMEPAGE_DESKTOP_DIMENSIONS,
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
    <main className='bg-white text-slate-900'>
      <div className='mx-auto max-w-[1920px]'>
        <div className='lg:hidden'>
          <NavbarNode mode='stacked' />
          <BannerNode mode='stacked' sectionClassName='-mt-px' />
          <CourseModuleNode mode='stacked' sectionClassName='-mt-px' />
          <FreeResourcesNode mode='stacked' sectionClassName='-mt-px' />
          <WhyJoiningOurCoursesNode mode='stacked' sectionClassName='-mt-px' />
          <FreeResourcesSecondaryNode mode='stacked' sectionClassName='-mt-px' />
          <RealStoriesNode mode='stacked' sectionClassName='-mt-px' />
          <FooterNode mode='stacked' sectionClassName='-mt-px' />
        </div>

        <div
          className='relative hidden w-full overflow-hidden lg:block'
          style={{
            aspectRatio: `${HOMEPAGE_DESKTOP_DIMENSIONS.width} / ${HOMEPAGE_DESKTOP_DIMENSIONS.height}`,
            backgroundColor: HOMEPAGE_COLORS.canvasBackground,
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
