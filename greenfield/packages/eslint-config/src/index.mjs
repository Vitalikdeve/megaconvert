import js from '@eslint/js';
import nextPlugin from '@next/eslint-plugin-next';
import globals from 'globals';
import importPlugin from 'eslint-plugin-import';
import jsxA11yPlugin from 'eslint-plugin-jsx-a11y';
import reactPlugin from 'eslint-plugin-react';
import reactHooksPlugin from 'eslint-plugin-react-hooks';
import tseslint from 'typescript-eslint';

const ignores = {
  ignores: [
    '**/.next/**',
    '**/coverage/**',
    '**/dist/**',
    '**/node_modules/**',
    '**/*.d.ts',
  ],
};

const importOrderRules = {
  'import/order': [
    'error',
    {
      alphabetize: {
        caseInsensitive: true,
        order: 'asc',
      },
      groups: ['builtin', 'external', 'internal', 'parent', 'sibling', 'index', 'type'],
      'newlines-between': 'always',
    },
  ],
};

export function createBaseConfig() {
  return [
    ignores,
    js.configs.recommended,
    ...tseslint.configs.recommended,
    {
      files: ['**/*.js', '**/*.cjs', '**/*.mjs'],
      languageOptions: {
        ecmaVersion: 'latest',
        globals: {
          ...globals.node,
        },
        sourceType: 'module',
      },
      rules: {
        '@typescript-eslint/no-require-imports': 'off',
      },
    },
    {
      files: ['**/*.ts', '**/*.tsx'],
      languageOptions: {
        ecmaVersion: 'latest',
        parser: tseslint.parser,
        parserOptions: {
          sourceType: 'module',
        },
      },
      plugins: {
        '@typescript-eslint': tseslint.plugin,
        import: importPlugin,
      },
      rules: {
        '@typescript-eslint/consistent-type-imports': 'error',
        '@typescript-eslint/no-explicit-any': 'error',
        '@typescript-eslint/no-unused-vars': [
          'error',
          {
            argsIgnorePattern: '^_',
            caughtErrorsIgnorePattern: '^_',
            varsIgnorePattern: '^_',
          },
        ],
        ...importOrderRules,
      },
      settings: {
        'import/resolver': {
          typescript: true,
        },
      },
    },
  ];
}

export function createNodeConfig({ files }) {
  return [
    {
      files,
      languageOptions: {
        globals: {
          ...globals.node,
        },
      },
      rules: {
        'no-console': 'off',
      },
    },
  ];
}

export function createNextConfig({ files }) {
  return [
    {
      files,
      languageOptions: {
        globals: {
          ...globals.browser,
          ...globals.node,
        },
      },
      plugins: {
        '@next/next': nextPlugin,
        'jsx-a11y': jsxA11yPlugin,
        react: reactPlugin,
        'react-hooks': reactHooksPlugin,
      },
      rules: {
        ...reactPlugin.configs.recommended.rules,
        ...reactHooksPlugin.configs.recommended.rules,
        ...jsxA11yPlugin.configs.recommended.rules,
        ...nextPlugin.configs.recommended.rules,
        'react/react-in-jsx-scope': 'off',
      },
      settings: {
        react: {
          version: 'detect',
        },
      },
    },
  ];
}
