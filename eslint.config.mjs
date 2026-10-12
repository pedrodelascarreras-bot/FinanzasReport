import js from '@eslint/js';
import globals from 'globals';

export default [
  {
    ignores: ['dist/**'],
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
];
