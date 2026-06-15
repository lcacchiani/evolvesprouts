import siteCommonJson from '@/content/site-common.json';

export interface SiteCommonContent {
  home: {
    title: string;
  };
  metadata: {
    title: string;
  };
  a11y: {
    logoLabel: string;
    websiteLinkLabel: string;
  };
}

export const SITE_COMMON = siteCommonJson as SiteCommonContent;
