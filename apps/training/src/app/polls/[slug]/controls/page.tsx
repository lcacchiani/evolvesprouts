import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { PollControlPage } from '@/components/polls/poll-control-page';
import {
  getAllPollSlugs,
  getPollContent,
  isValidPollSlug,
  POLLS_COMMON,
} from '@/lib/polls';

interface PollControlsRouteProps {
  params: Promise<{ slug: string }>;
}

export function generateStaticParams() {
  return getAllPollSlugs().map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: PollControlsRouteProps): Promise<Metadata> {
  const { slug } = await params;
  if (!isValidPollSlug(slug)) {
    return {};
  }
  const poll = getPollContent(slug);
  if (!poll) {
    return {};
  }
  return {
    title: `${POLLS_COMMON.control.title} — ${poll.title}`,
    robots: {
      index: false,
      follow: false,
      noarchive: true,
    },
  };
}

export default async function PollControlsRoutePage({ params }: PollControlsRouteProps) {
  const { slug } = await params;
  if (!isValidPollSlug(slug)) {
    notFound();
  }
  const poll = getPollContent(slug);
  if (!poll || poll.slug !== slug) {
    notFound();
  }

  return <PollControlPage poll={poll} common={POLLS_COMMON} />;
}
