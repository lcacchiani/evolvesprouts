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
    files: ['**/*.{ts,tsx,js,jsx,mjs,cjs}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: [
            {
              name: 'react',
              importNames: ['CSSProperties'],
              message: 'Use CSS classes/files instead of CSSProperties.',
            },
          ],
        },
      ],
      'no-restricted-syntax': [
        'error',
        {
          selector: "JSXAttribute[name.name='style']",
          message: 'Inline style props are not allowed. Move styling to CSS files.',
        },
        {
          selector: "TSTypeReference[typeName.name='CSSProperties']",
          message: 'CSSProperties types are not allowed. Move styling to CSS files.',
        },
        {
          selector: "TSTypeReference[typeName.right.name='CSSProperties']",
          message: 'React.CSSProperties is not allowed. Move styling to CSS files.',
        },
      ],
    },
  },
  {
    ignores: ['node_modules/**', 'e2e/**', 'playwright.config.ts'],
  },
];
