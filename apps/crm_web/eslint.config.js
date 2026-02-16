const { fixupConfigRules } = require('@eslint/compat');
const espree = require('espree');
const nextConfig = require('eslint-config-next');

module.exports = [
  ...fixupConfigRules(nextConfig),
  {
    files: ['**/*.{js,jsx,mjs,cjs}'],
    languageOptions: {
      parser: espree,
    },
  },
  {
    ignores: ['node_modules/**', 'e2e/**', 'playwright.config.ts'],
  },
];
