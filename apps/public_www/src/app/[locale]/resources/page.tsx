import { createLocaleAliasRedirectPage } from '@/lib/locale-page';
import { buildLocalizedResourcesHashPath } from '@/lib/routes';

export { generateLocaleStaticParams as generateStaticParams } from '@/lib/locale-page';

export default createLocaleAliasRedirectPage((locale) =>
  buildLocalizedResourcesHashPath(locale),
);
