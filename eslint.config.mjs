import js from '@eslint/js';
import globals from 'globals';

const sharedRules = {
  'no-unused-vars': ['warn', { args: 'none', ignoreRestSiblings: true }],
  'no-empty': ['error', { allowEmptyCatch: true }],
};

export default [
  {
    ignores: ['dist/**', 'report/node_modules/**'],
  },
  js.configs.recommended,
  {
    files: ['js/**/*.js'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'script',
      globals: {
        ...globals.browser,
        ...globals.es2021,
        Chart: 'readonly',
        Papa: 'readonly',
        gsap: 'readonly',
        html2canvas: 'readonly',
        jspdf: 'readonly',
        google: 'readonly',
      },
    },
    rules: {
      'no-empty': ['error', { allowEmptyCatch: true }],
      'no-undef': 'off',
      'no-unused-vars': 'off',
    },
  },
  {
    files: ['report/*.js'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'commonjs',
      globals: {
        ...globals.node,
        ...globals.es2021,
      },
    },
    rules: sharedRules,
  },
];
