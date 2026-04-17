import { redirect } from 'next/navigation';

import { DEFAULT_ADMIN_SECTION_PATH } from '@/lib/admin-nav';

export default function HomePage() {
  redirect(DEFAULT_ADMIN_SECTION_PATH);
}
