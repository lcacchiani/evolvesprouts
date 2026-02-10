export interface HomepageNodeFrame {
  nodeId: string;
  nodeName: string;
  imageSrc: string;
  x: number;
  y: number;
  width: number;
  height: number;
  imageWidth: number;
  imageHeight: number;
}

export const HOMEPAGE_DESKTOP_DIMENSIONS = {
  width: 1920,
  height: 9299,
} as const;

export const HOMEPAGE_MOBILE_DIMENSIONS = {
  width: 402,
  height: 8377,
} as const;

export const HOMEPAGE_COLORS = {
  baseBackground: '#FFEFE3',
  darkBackground: '#121212',
} as const;

const NODE_IMAGE_BASE_PATH = '/images/homepage/nodes';

export const NAVBAR_NODE: HomepageNodeFrame = {
  nodeId: '0:2653',
  nodeName: 'navbar',
  imageSrc: `${NODE_IMAGE_BASE_PATH}/navbar.png`,
  x: 227.76220703125,
  y: 10.359375,
  width: 1465.39111328125,
  height: 114.589599609375,
  imageWidth: 2931,
  imageHeight: 230,
};

export const BANNER_NODE: HomepageNodeFrame = {
  nodeId: '0:2566',
  nodeName: 'banner',
  imageSrc: `${NODE_IMAGE_BASE_PATH}/banner.png`,
  x: 0,
  y: 95.359375,
  width: 1735.48974609375,
  height: 841,
  imageWidth: 3454,
  imageHeight: 1682,
};

export const COURSE_MODULE_NODE: HomepageNodeFrame = {
  nodeId: '0:2357',
  nodeName: 'Course module',
  imageSrc: `${NODE_IMAGE_BASE_PATH}/course-module.png`,
  x: 227.76220703125,
  y: 1121.671875,
  width: 1585.0625,
  height: 1453.96875,
  imageWidth: 3243,
  imageHeight: 2901,
};

export const FREE_RESOURCES_TOP_NODE: HomepageNodeFrame = {
  nodeId: '0:2130',
  nodeName: 'Free Resources',
  imageSrc: `${NODE_IMAGE_BASE_PATH}/free-resources-top.png`,
  x: 228.07080078125,
  y: 2722.0859375,
  width: 1464,
  height: 848,
  imageWidth: 2928,
  imageHeight: 1696,
};

export const WHY_JOINING_COURSES_NODE: HomepageNodeFrame = {
  nodeId: '0:1830',
  nodeName: 'Why Joining Our Courses',
  imageSrc: `${NODE_IMAGE_BASE_PATH}/why-joining-our-courses.png`,
  x: 0.07080078125,
  y: 3716.5390625,
  width: 1920,
  height: 1651,
  imageWidth: 3840,
  imageHeight: 3302,
};

export const FREE_RESOURCES_BOTTOM_NODE: HomepageNodeFrame = {
  nodeId: '0:1667',
  nodeName: 'Free Resources',
  imageSrc: `${NODE_IMAGE_BASE_PATH}/free-resources-bottom.png`,
  x: 227.57080078125,
  y: 5467.4921875,
  width: 1465.5,
  height: 1110.765625,
  imageWidth: 2931,
  imageHeight: 2222,
};

export const REAL_STORIES_NODE: HomepageNodeFrame = {
  nodeId: '0:1432',
  nodeName: 'Real Stories',
  imageSrc: `${NODE_IMAGE_BASE_PATH}/real-stories.png`,
  x: 210,
  y: 6592,
  width: 1488,
  height: 1069.6953125,
  imageWidth: 2976,
  imageHeight: 2140,
};

export const FOOTER_NODE: HomepageNodeFrame = {
  nodeId: '0:1229',
  nodeName: 'footer',
  imageSrc: `${NODE_IMAGE_BASE_PATH}/footer.png`,
  x: 0.07080078125,
  y: 7816.3125,
  width: 1920,
  height: 1482.9296875,
  imageWidth: 3840,
  imageHeight: 2966,
};

export const HOMEPAGE_MOBILE_FULL_IMAGE = {
  src: `${NODE_IMAGE_BASE_PATH}/mobile-full.png`,
  width: 787,
  height: 16384,
} as const;
