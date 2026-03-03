import type { MetadataRoute } from 'next';

import { SITE_HOST, SITE_ORIGIN } from '@/lib/seo';

const AI_CRAWLER_USER_AGENTS = [
  'GPTBot',
  'ChatGPT-User',
  'Google-Extended',
  'GoogleOther',
  'anthropic-ai',
  'Claude-Web',
  'Bytespider',
  'CCBot',
  'PerplexityBot',
  'Applebot-Extended',
  'cohere-ai',
  'Diffbot',
  'ImagesiftBot',
  'Omgilibot',
  'Amazonbot',
] as const;

export const dynamic = 'force-static';

export default function robots(): MetadataRoute.Robots {
  const aiCrawlerRules = AI_CRAWLER_USER_AGENTS.map((userAgent) => ({
    userAgent,
    allow: ['/', '/llms.txt', '/llms-full.txt'],
  }));

  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
      },
      ...aiCrawlerRules,
    ],
    sitemap: `${SITE_ORIGIN}/sitemap.xml`,
    host: SITE_HOST,
  };
}
