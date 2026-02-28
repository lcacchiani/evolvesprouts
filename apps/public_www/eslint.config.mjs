import { fixupConfigRules } from '@eslint/compat';
import * as espree from 'espree';
import nextConfig from 'eslint-config-next';
import jsxA11y from 'eslint-plugin-jsx-a11y';

const eslintConfig = [
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
      ...jsxA11y.configs.recommended.rules,
      'react/no-danger': 'error',
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'error',
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
        {
          selector: 'TSAnyKeyword',
          message: 'Explicit `any` is not allowed. Use a specific type.',
        },
      ],
    },
  },
  {
    ignores: ['node_modules/**'],
  },
];

export default eslintConfig;
