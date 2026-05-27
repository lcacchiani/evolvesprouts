import { fixupConfigRules } from '@eslint/compat';
import nextConfig from 'eslint-config-next';

const eslintConfig = [
  ...fixupConfigRules(nextConfig),
  {
    files: ['**/*.{ts,tsx,js,jsx,mjs,cjs}'],
    rules: {
      'no-restricted-syntax': [
        'error',
        {
          selector: "JSXAttribute[name.name='style']",
          message: 'Inline style props are not allowed. Move styling to CSS files.',
        },
      ],
    },
  },
];

export default eslintConfig;
