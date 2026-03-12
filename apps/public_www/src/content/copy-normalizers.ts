import type {
  EventNotificationContent,
  FreeIntroSessionContent,
  HeroContent,
  IdaIntroContent,
  MyBestAuntieHeroContent,
  SiteContent,
  SproutsSquadCommunityContent,
} from '@/content';

interface SectionCopy {
  title: string;
  subtitle: string;
  description: string;
}

function readRequiredText(record: Record<string, unknown>, key: string, sectionName: string): string {
  const value = record[key];
  if (typeof value !== 'string') {
    throw new Error(`Missing required "${key}" copy value for "${sectionName}".`);
  }

  const normalizedValue = value.trim();
  if (normalizedValue === '') {
    throw new Error(`Empty "${key}" copy value for "${sectionName}".`);
  }
  return normalizedValue;
}

export function resolveHeroCopy(content: HeroContent): SectionCopy {
  const record = content as unknown as Record<string, unknown>;
  return {
    title: readRequiredText(record, 'title', 'hero'),
    subtitle: readRequiredText(record, 'subtitle', 'hero'),
    description: readRequiredText(record, 'description', 'hero'),
  };
}

export function resolveIdaIntroCopy(content: IdaIntroContent): Pick<SectionCopy, 'title' | 'description'> {
  const record = content as unknown as Record<string, unknown>;
  return {
    title: readRequiredText(record, 'title', 'idaIntro'),
    description: readRequiredText(record, 'description', 'idaIntro'),
  };
}

export function resolveMyBestAuntieHeroDescription(content: MyBestAuntieHeroContent): string {
  const record = content as unknown as Record<string, unknown>;
  return readRequiredText(record, 'description', 'myBestAuntieHero');
}

export function resolveSproutsSquadCommunityCopy(
  content: SproutsSquadCommunityContent,
): Pick<SectionCopy, 'title' | 'description'> {
  const record = content as unknown as Record<string, unknown>;
  return {
    title: readRequiredText(record, 'title', 'sproutsSquadCommunity'),
    description: readRequiredText(record, 'description', 'sproutsSquadCommunity'),
  };
}

export function resolveEventNotificationCopy(
  content: EventNotificationContent,
): Pick<SectionCopy, 'title' | 'description'> {
  const record = content as unknown as Record<string, unknown>;
  return {
    title: readRequiredText(record, 'title', 'eventNotification'),
    description: readRequiredText(record, 'description', 'eventNotification'),
  };
}

export function resolveFreeIntroSessionCopy(
  content: FreeIntroSessionContent,
): Pick<SectionCopy, 'title' | 'description'> {
  const record = content as unknown as Record<string, unknown>;
  return {
    title: readRequiredText(record, 'title', 'freeIntroSession'),
    description: readRequiredText(record, 'description', 'freeIntroSession'),
  };
}

export function resolvePolicyDescription(
  content: SiteContent['privacyPolicy'] | SiteContent['termsAndConditions'],
): string {
  const record = content as unknown as Record<string, unknown>;
  return readRequiredText(record, 'description', 'policySection');
}
