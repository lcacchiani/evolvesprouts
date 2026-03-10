import type {
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

function readOptionalText(record: Record<string, unknown>, key: string): string | undefined {
  const value = record[key];
  if (typeof value !== 'string') {
    return undefined;
  }

  const normalizedValue = value.trim();
  return normalizedValue === '' ? undefined : normalizedValue;
}

function resolveRequiredText(
  record: Record<string, unknown>,
  canonicalKey: string,
  legacyKey: string,
  sectionName: string,
): string {
  const canonicalValue = readOptionalText(record, canonicalKey);
  if (canonicalValue) {
    return canonicalValue;
  }

  const legacyValue = readOptionalText(record, legacyKey);
  if (legacyValue) {
    return legacyValue;
  }

  throw new Error(
    `Missing copy value for "${sectionName}". Provide "${canonicalKey}" (preferred) or "${legacyKey}" (legacy).`,
  );
}

export function resolveHeroCopy(content: HeroContent): SectionCopy {
  const record = content as unknown as Record<string, unknown>;
  return {
    title: resolveRequiredText(record, 'title', 'headline', 'hero'),
    subtitle: resolveRequiredText(record, 'subtitle', 'subheadline', 'hero'),
    description: resolveRequiredText(record, 'description', 'supportingParagraph', 'hero'),
  };
}

export function resolveIdaIntroCopy(content: IdaIntroContent): Pick<SectionCopy, 'title' | 'description'> {
  const record = content as unknown as Record<string, unknown>;
  return {
    title: resolveRequiredText(record, 'title', 'heading', 'idaIntro'),
    description: resolveRequiredText(record, 'description', 'body', 'idaIntro'),
  };
}

export function resolveMyBestAuntieHeroDescription(content: MyBestAuntieHeroContent): string {
  const record = content as unknown as Record<string, unknown>;
  return resolveRequiredText(record, 'description', 'body', 'myBestAuntieHero');
}

export function resolveSproutsSquadCommunityCopy(
  content: SproutsSquadCommunityContent,
): Pick<SectionCopy, 'title' | 'description'> {
  const record = content as unknown as Record<string, unknown>;
  return {
    title: resolveRequiredText(record, 'title', 'heading', 'sproutsSquadCommunity'),
    description: resolveRequiredText(record, 'description', 'supportParagraph', 'sproutsSquadCommunity'),
  };
}

export function resolveFreeIntroSessionCopy(
  content: FreeIntroSessionContent,
): Pick<SectionCopy, 'title' | 'description'> {
  const record = content as unknown as Record<string, unknown>;
  return {
    title: resolveRequiredText(record, 'title', 'heading', 'freeIntroSession'),
    description: resolveRequiredText(record, 'description', 'supportParagraph', 'freeIntroSession'),
  };
}

export function resolvePolicyDescription(
  content: SiteContent['privacyPolicy'] | SiteContent['termsAndConditions'],
): string {
  const record = content as unknown as Record<string, unknown>;
  return resolveRequiredText(
    record,
    'description',
    'intro',
    'policySection',
  );
}
