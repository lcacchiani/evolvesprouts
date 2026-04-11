import type {
  EventNotificationContent,
  FreeIntroSessionContent,
  HeroContent,
  AboutUsIntroContent,
  MyBestAuntieHeroContent,
  SiteContent,
  SproutsSquadCommunityContent,
} from '@/content';
import {
  readOptionalText,
  readRequiredRecordText,
} from '@/content/content-field-utils';

interface SectionCopy {
  title: string;
  subtitle: string;
  description: string;
}

export function resolveHeroCopy(content: HeroContent): SectionCopy {
  const record = content as unknown as Record<string, unknown>;
  return {
    title: readRequiredRecordText(record, 'title', 'hero'),
    subtitle: readRequiredRecordText(record, 'subtitle', 'hero'),
    description: readRequiredRecordText(record, 'description', 'hero'),
  };
}

export function resolveAboutUsIntroCopy(content: AboutUsIntroContent): Pick<SectionCopy, 'title' | 'description'> {
  const record = content as unknown as Record<string, unknown>;
  return {
    title: readRequiredRecordText(record, 'title', 'aboutUs.intro'),
    description: readRequiredRecordText(record, 'description', 'aboutUs.intro'),
  };
}

export function resolveMyBestAuntieHeroDescription(content: MyBestAuntieHeroContent): string {
  const record = content as unknown as Record<string, unknown>;
  return readRequiredRecordText(record, 'description', 'myBestAuntie.hero');
}

export function resolveSproutsSquadCommunityCopy(
  content: SproutsSquadCommunityContent,
): Pick<SectionCopy, 'title' | 'description'> & { mailchimpFirstNameFallback: string } {
  const record = content as unknown as Record<string, unknown>;
  return {
    title: readRequiredRecordText(record, 'title', 'sproutsSquadCommunity'),
    description: readRequiredRecordText(record, 'description', 'sproutsSquadCommunity'),
    mailchimpFirstNameFallback:
      readOptionalText(record.mailchimpFirstNameFallback) ?? 'Friend',
  };
}

export function resolveEventNotificationCopy(
  content: EventNotificationContent,
): Pick<SectionCopy, 'title' | 'description'> & { mailchimpFirstNameFallback: string } {
  const record = content as unknown as Record<string, unknown>;
  return {
    title: readRequiredRecordText(record, 'title', 'eventNotification'),
    description: readRequiredRecordText(record, 'description', 'eventNotification'),
    mailchimpFirstNameFallback:
      readOptionalText(record.mailchimpFirstNameFallback) ?? 'Friend',
  };
}

export function resolveFreeIntroSessionCopy(
  content: FreeIntroSessionContent,
): Pick<SectionCopy, 'title' | 'description'> {
  const record = content as unknown as Record<string, unknown>;
  return {
    title: readRequiredRecordText(record, 'title', 'freeIntroSession'),
    description: readRequiredRecordText(record, 'description', 'freeIntroSession'),
  };
}

export function resolvePolicyDescription(
  content: SiteContent['privacyPolicy'] | SiteContent['termsAndConditions'],
): string {
  const record = content as unknown as Record<string, unknown>;
  return readRequiredRecordText(record, 'description', 'policySection');
}
