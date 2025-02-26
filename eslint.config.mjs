import globals from 'globals';
import pluginJs from '@eslint/js';
import tseslint from 'typescript-eslint';

/** @type {import('eslint').Linter.Config[]} */
export default [
  {files: ['**/*.{js,mjs,cjs,ts}']},
  {languageOptions: { globals: globals.browser }},
  pluginJs.configs.recommended,
  ...tseslint.configs.recommended,
  {
    rules: {
      indent: ['error', 2],
      '@/indent': ['error', 2],
      '@typescript-eslint/ban-ts-comment': 'off',
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unused-vars': 'off',
      'quote-props': ['error', 'as-needed'],
      quotes: ['error', 'single', { avoidEscape: true, allowTemplateLiterals: true }],
      'prefer-const': 'off',
      'no-empty': 'off',
      'no-unused-vars': 'off'
    }
  }
];
