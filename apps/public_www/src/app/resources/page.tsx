import { DEFAULT_LOCALE } from '@/content';
import { createRootRedirectPage } from '@/lib/locale-page';
import { buildLocalizedResourcesHashPath } from '@/lib/routes';

export default createRootRedirectPage(buildLocalizedResourcesHashPath(DEFAULT_LOCALE));
