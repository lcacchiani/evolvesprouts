import { FigmaNodeLayer } from './figma-node-layer';
import {
  BANNER_NODE,
  COURSE_MODULE_NODE,
  FOOTER_NODE,
  FREE_RESOURCES_BOTTOM_NODE,
  FREE_RESOURCES_TOP_NODE,
  NAVBAR_NODE,
  REAL_STORIES_NODE,
  WHY_JOINING_COURSES_NODE,
} from './homepage-design-tokens';

export function NavbarNode() {
  return <FigmaNodeLayer frame={NAVBAR_NODE} priority />;
}

export function BannerNode() {
  return <FigmaNodeLayer frame={BANNER_NODE} priority />;
}

export function CourseModuleNode() {
  return <FigmaNodeLayer frame={COURSE_MODULE_NODE} />;
}

export function FreeResourcesNode() {
  return <FigmaNodeLayer frame={FREE_RESOURCES_TOP_NODE} />;
}

export function WhyJoiningOurCoursesNode() {
  return <FigmaNodeLayer frame={WHY_JOINING_COURSES_NODE} />;
}

export function FreeResourcesSecondaryNode() {
  return <FigmaNodeLayer frame={FREE_RESOURCES_BOTTOM_NODE} />;
}

export function RealStoriesNode() {
  return <FigmaNodeLayer frame={REAL_STORIES_NODE} />;
}

export function FooterNode() {
  return <FigmaNodeLayer frame={FOOTER_NODE} />;
}
