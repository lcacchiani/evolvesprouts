import { FigmaNodeLayer, FigmaNodeStackSection } from './figma-node-layer';
import {
  BANNER_NODE,
  COURSE_MODULE_NODE,
  FOOTER_NODE,
  FREE_RESOURCES_BOTTOM_NODE,
  FREE_RESOURCES_TOP_NODE,
  NAVBAR_NODE,
  REAL_STORIES_NODE,
  type HomepageNodeFrame,
  WHY_JOINING_COURSES_NODE,
} from './homepage-design-tokens';

interface NodeSectionProps {
  mode?: 'desktop' | 'stacked';
  priority?: boolean;
  sectionClassName?: string;
}

function renderNode(
  frame: HomepageNodeFrame,
  {
    mode = 'desktop',
    priority = false,
    sectionClassName,
  }: NodeSectionProps,
) {
  if (mode === 'stacked') {
    return (
      <FigmaNodeStackSection
        frame={frame}
        priority={priority}
        sectionClassName={sectionClassName}
      />
    );
  }

  return <FigmaNodeLayer frame={frame} priority={priority} />;
}

export function NavbarNode(props: NodeSectionProps) {
  return renderNode(NAVBAR_NODE, { priority: true, ...props });
}

export function BannerNode(props: NodeSectionProps) {
  return renderNode(BANNER_NODE, { priority: true, ...props });
}

export function CourseModuleNode(props: NodeSectionProps) {
  return renderNode(COURSE_MODULE_NODE, props);
}

export function FreeResourcesNode(props: NodeSectionProps) {
  return renderNode(FREE_RESOURCES_TOP_NODE, props);
}

export function WhyJoiningOurCoursesNode(props: NodeSectionProps) {
  return renderNode(WHY_JOINING_COURSES_NODE, props);
}

export function FreeResourcesSecondaryNode(props: NodeSectionProps) {
  return renderNode(FREE_RESOURCES_BOTTOM_NODE, props);
}

export function RealStoriesNode(props: NodeSectionProps) {
  return renderNode(REAL_STORIES_NODE, props);
}

export function FooterNode(props: NodeSectionProps) {
  return renderNode(FOOTER_NODE, props);
}
