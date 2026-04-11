import '@testing-library/jest-dom/vitest';

process.env.NEXT_PUBLIC_EMAIL = process.env.NEXT_PUBLIC_EMAIL ?? 'tests@example.com';

// Vitest uses jsdom with a localhost origin. CI or local `.env*` may set
// `NEXT_PUBLIC_WWW_PROXY_ALLOWED_HOSTS` (e.g. including `localhost`), which makes
// `buildCrmApiUrl` rewrite `https://api…/www` to relative `/www/...` and breaks
// tests that assert absolute URLs. Proxy rewrite behavior is covered in
// `tests/lib/crm-api-client.test.ts`, which stubs these env vars in `beforeEach`.
process.env.NEXT_PUBLIC_WWW_PROXY_ALLOWED_HOSTS = '';
