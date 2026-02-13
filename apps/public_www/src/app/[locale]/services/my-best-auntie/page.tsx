import { redirect } from 'next/navigation';

interface LegacyMyBestAuntiePageProps {
  params: Promise<{ locale: string }>;
}

export default async function LegacyMyBestAuntiePage({
  params,
}: LegacyMyBestAuntiePageProps) {
  const { locale } = await params;
  redirect(`/${locale}/services/my-best-auntie-training-course`);
}
