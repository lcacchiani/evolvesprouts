import { createLocaleAliasRedirectPage } from '@/lib/locale-page';
import { ROUTES } from '@/lib/routes';

export { generateLocaleStaticParams as generateStaticParams } from '@/lib/locale-page';

export default createLocaleAliasRedirectPage(ROUTES.contact);
