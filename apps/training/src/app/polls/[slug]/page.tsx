import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { PollPage } from '@/components/polls/poll-page';
import {
  getAllPollSlugs,
  getPollContent,
  isValidPollSlug,
  POLLS_COMMON,
} from '@/lib/polls';

interface PollRouteProps {
  params: Promise<{ slug: string }>;
}

export function generateStaticParams() {
  return getAllPollSlugs().map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: PollRouteProps): Promise<Metadata> {
  const { slug } = await params;
  if (!isValidPollSlug(slug)) {
    return {};
  }
  const poll = getPollContent(slug);
  if (!poll) {
    return {};
  }
  return {
    title: poll.title,
    robots: {
      index: false,
      follow: false,
      noarchive: true,
    },
  };
}

export default async function PollRoutePage({ params }: PollRouteProps) {
  const { slug } = await params;
  if (!isValidPollSlug(slug)) {
    notFound();
  }
  const poll = getPollContent(slug);
  if (!poll || poll.slug !== slug) {
    notFound();
  }

  return <PollPage poll={poll} common={POLLS_COMMON} />;
}
