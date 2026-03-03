import { getContent } from '@/content';
import { buildLlmsFullTxt } from '@/lib/llms-content';

export const dynamic = 'force-static';

export function GET(): Response {
  const content = getContent('en');
  const body = buildLlmsFullTxt(content);

  return new Response(body, {
    headers: {
      'Content-Type': 'text/markdown; charset=utf-8',
    },
  });
}
